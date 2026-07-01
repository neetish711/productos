import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import type { AIProviderClient, AICompletionOptions, AICompletionResult, AIProviderType } from '@/types/ai'
import { estimateCost } from '@/types/ai'

// ─── AUDIT P0-7: Usage logging + per-org budget enforcement ────────────────────
// Previously nothing checked spend before an LLM call and only one route logged
// usage. We wrap every client's complete() so ALL call sites are metered and
// bounded centrally.

/** Thrown when an org exceeds its monthly LLM token budget. Routes should map
 *  this to HTTP 429. */
export class LLMBudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMBudgetExceededError'
  }
}

// 0 or unset in env => fall back to this default; a per-org override may be set
// in Organization.settingsJson as { "llmMonthlyTokenBudget": <number> }.
// Set the org/env budget to 0 to disable the cap (unlimited).
const DEFAULT_MONTHLY_TOKEN_BUDGET = Number(process.env.LLM_MONTHLY_TOKEN_BUDGET ?? 5_000_000)

function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

async function getOrgMonthlyTokenBudget(orgId: string): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settingsJson: true },
  })
  try {
    const settings = JSON.parse(org?.settingsJson ?? '{}')
    if (typeof settings.llmMonthlyTokenBudget === 'number' && settings.llmMonthlyTokenBudget >= 0) {
      return settings.llmMonthlyTokenBudget
    }
  } catch {
    // fall through to env default
  }
  return DEFAULT_MONTHLY_TOKEN_BUDGET
}

async function assertWithinBudget(orgId: string): Promise<void> {
  const budget = await getOrgMonthlyTokenBudget(orgId)
  if (!Number.isFinite(budget) || budget <= 0) return // 0/disabled = unlimited
  const agg = await prisma.promptExecutionLog.aggregate({
    where: { organizationId: orgId, createdAt: { gte: startOfCurrentMonth() } },
    _sum: { totalTokens: true },
  })
  const used = agg._sum.totalTokens ?? 0
  if (used >= budget) {
    throw new LLMBudgetExceededError(
      `Monthly LLM token budget exceeded (${used.toLocaleString()}/${budget.toLocaleString()} tokens). ` +
        `Raise the limit in organization settings or wait for the next billing cycle.`,
    )
  }
}

async function logExecution(
  orgId: string,
  info: { provider?: string; model?: string; inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCost?: number; durationMs?: number },
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  try {
    await prisma.promptExecutionLog.create({
      data: {
        organizationId: orgId,
        provider: info.provider ?? 'unknown',
        model: info.model ?? 'unknown',
        inputTokens: info.inputTokens ?? 0,
        outputTokens: info.outputTokens ?? 0,
        totalTokens: info.totalTokens ?? 0,
        estimatedCost: info.estimatedCost ?? 0,
        durationMs: info.durationMs ?? 0,
        success,
        errorMessage: errorMessage ?? null,
      },
    })
  } catch (e) {
    // Logging must never break a generation; surface but don't throw.
    console.error('Failed to write PromptExecutionLog:', e)
  }
}

// AUDIT S2-2: hard input-size cap. Assembled DB context (features/updates lists)
// was unbounded and overflowed the model window → "prompt too long" 500s. This is
// a backstop that truncates oversized input before the call so it degrades
// gracefully instead of failing. Per-call-sites also bound their own context.
const MAX_INPUT_CHARS = Number(process.env.LLM_MAX_INPUT_CHARS ?? 500_000)

function clampMessages(messages: AICompletionOptions['messages']): AICompletionOptions['messages'] {
  const total = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
  if (total <= MAX_INPUT_CHARS) return messages
  // Trim the single largest message to bring the total under the cap.
  let largestIdx = 0
  for (let i = 1; i < messages.length; i++) {
    if ((messages[i].content?.length ?? 0) > (messages[largestIdx].content?.length ?? 0)) largestIdx = i
  }
  const overflow = total - MAX_INPUT_CHARS
  const largest = messages[largestIdx]
  const keep = Math.max(0, (largest.content?.length ?? 0) - overflow - 100)
  const clamped = messages.slice()
  clamped[largestIdx] = {
    ...largest,
    content: (largest.content ?? '').slice(0, keep) + '\n\n[... input truncated to fit the model context window ...]',
  }
  return clamped
}

/** Wrap a client so every complete() checks the org budget first and logs after. */
function withUsageTracking(client: AIProviderClient, orgId: string): AIProviderClient {
  const originalComplete = client.complete.bind(client)
  client.complete = async (opts: AICompletionOptions): Promise<AICompletionResult> => {
    opts = { ...opts, messages: clampMessages(opts.messages) }
    await assertWithinBudget(orgId)
    try {
      const result = await originalComplete(opts)
      await logExecution(orgId, result, true)
      return result
    } catch (err: any) {
      if (err instanceof LLMBudgetExceededError) throw err
      await logExecution(
        orgId,
        { provider: client.provider, model: opts.model ?? client.defaultModel },
        false,
        err?.message,
      )
      throw err
    }
  }
  return client
}

// ─── OpenAI Adapter ───────────────────────────────────────────────────────────
class OpenAIClient implements AIProviderClient {
  provider: AIProviderType = 'openai'
  constructor(private apiKey: string, public defaultModel: string) {}

  async complete(opts: AICompletionOptions): Promise<AICompletionResult> {
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: this.apiKey })
    const start = Date.now()
    const response = await client.chat.completions.create({
      model: opts.model ?? this.defaultModel,
      messages: opts.messages as any,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.3,
      response_format: opts.jsonMode ? { type: 'json_object' } : undefined,
    })
    const durationMs = Date.now() - start
    const content = response.choices[0]?.message?.content ?? ''
    const inputTokens = response.usage?.prompt_tokens ?? 0
    const outputTokens = response.usage?.completion_tokens ?? 0
    return { content, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, model: opts.model ?? this.defaultModel, provider: 'openai', durationMs, estimatedCost: estimateCost(opts.model ?? this.defaultModel, inputTokens, outputTokens) }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
    try {
      const { OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: this.apiKey })
      const models = await client.models.list()
      const chatModels = models.data.filter((m) => m.id.includes('gpt')).map((m) => m.id).slice(0, 10)
      return { ok: true, message: 'Connected', models: chatModels }
    } catch (e: any) { return { ok: false, message: e.message } }
  }
}

// ─── Anthropic Adapter ────────────────────────────────────────────────────────
class AnthropicClient implements AIProviderClient {
  provider: AIProviderType = 'anthropic'
  constructor(private apiKey: string, public defaultModel: string) {}

  async complete(opts: AICompletionOptions): Promise<AICompletionResult> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: this.apiKey })
    const start = Date.now()
    const systemMsg = opts.messages.find((m) => m.role === 'system')?.content
    const userMessages = opts.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const response = await client.messages.create({
      model: opts.model ?? this.defaultModel,
      max_tokens: opts.maxTokens ?? 2000,
      system: systemMsg,
      messages: userMessages,
    })
    const durationMs = Date.now() - start
    const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    return { content, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, model: opts.model ?? this.defaultModel, provider: 'anthropic', durationMs, estimatedCost: estimateCost(opts.model ?? this.defaultModel, inputTokens, outputTokens) }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({ apiKey: this.apiKey })
      await client.messages.create({ model: this.defaultModel, max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] })
      return { ok: true, message: 'Connected', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] }
    } catch (e: any) { return { ok: false, message: e.message } }
  }
}

// ─── Gemini Adapter ───────────────────────────────────────────────────────────
class GeminiClient implements AIProviderClient {
  provider: AIProviderType = 'gemini'
  constructor(private apiKey: string, public defaultModel: string) {}

  async complete(opts: AICompletionOptions): Promise<AICompletionResult> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const client = new GoogleGenerativeAI(this.apiKey)
    const model = client.getGenerativeModel({ model: opts.model ?? this.defaultModel })
    const start = Date.now()
    const prompt = opts.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')
    const result = await model.generateContent(prompt)
    const durationMs = Date.now() - start
    const content = result.response.text()
    const inputTokens = result.response.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0
    return { content, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, model: opts.model ?? this.defaultModel, provider: 'gemini', durationMs, estimatedCost: estimateCost(opts.model ?? this.defaultModel, inputTokens, outputTokens) }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const client = new GoogleGenerativeAI(this.apiKey)
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' })
      await model.generateContent('hi')
      return { ok: true, message: 'Connected', models: ['gemini-1.5-pro', 'gemini-1.5-flash'] }
    } catch (e: any) { return { ok: false, message: e.message } }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createAIClient(provider: AIProviderType, apiKey: string, defaultModel: string): AIProviderClient {
  switch (provider) {
    case 'openai': return new OpenAIClient(apiKey, defaultModel)
    case 'anthropic': return new AnthropicClient(apiKey, defaultModel)
    case 'gemini': return new GeminiClient(apiKey, defaultModel)
    default: throw new Error(`Unsupported provider: ${provider}`)
  }
}

export async function getAIClient(orgId: string): Promise<AIProviderClient> {
  const config = await prisma.lLMConfig.findFirst({
    where: { organizationId: orgId, isActive: true },
  })

  if (!config) {
    // Fallback to env vars for dev convenience
    if (process.env.ANTHROPIC_API_KEY) return withUsageTracking(createAIClient('anthropic', process.env.ANTHROPIC_API_KEY, 'claude-sonnet-4-6'), orgId)
    if (process.env.OPENAI_API_KEY) return withUsageTracking(createAIClient('openai', process.env.OPENAI_API_KEY, 'gpt-4o-mini'), orgId)
    throw new Error('No active LLM configuration found. Please configure an LLM provider in Settings > LLM Configuration.')
  }

  const apiKey = decrypt(config.apiKeyEncrypted, config.iv)
  // AUDIT P0-7: meter + budget-check every call made through this client.
  return withUsageTracking(createAIClient(config.provider.toLowerCase() as AIProviderType, apiKey, config.defaultModel), orgId)
}

/**
 * AUDIT P0-7: Resolve a usage-tracked client for a specific saved LLMConfig.
 * Centralizes the decrypt+createAIClient logic that routes previously inlined
 * (which bypassed budget/logging). Returns null when the config isn't found for
 * this org, so callers can fall back to getAIClient(orgId).
 */
export async function getAIClientForConfigId(orgId: string, configId: string): Promise<AIProviderClient | null> {
  const config = await prisma.lLMConfig.findFirst({ where: { id: configId, organizationId: orgId } })
  if (!config) return null
  const apiKey = decrypt(config.apiKeyEncrypted, config.iv)
  return withUsageTracking(createAIClient(config.provider.toLowerCase() as AIProviderType, apiKey, config.defaultModel), orgId)
}

/**
 * Get AI client for a specific role (PLANNER, EXTRACTION, SYNTHESIS, CRITIQUE, SUMMARY).
 * Falls back to the DEFAULT / active config if no role-specific config exists.
 */
export async function getAIClientForRole(orgId: string, role: string): Promise<AIProviderClient> {
  // Try role-specific config first
  const roleConfig = await prisma.lLMConfig.findFirst({
    where: { organizationId: orgId, role, isActive: true },
  })

  if (roleConfig) {
    const apiKey = decrypt(roleConfig.apiKeyEncrypted, roleConfig.iv)
    // AUDIT P0-7: meter + budget-check every call made through this client.
    return withUsageTracking(createAIClient(roleConfig.provider.toLowerCase() as AIProviderType, apiKey, roleConfig.defaultModel), orgId)
  }

  // Fall back to default active config (already usage-tracked by getAIClient).
  return getAIClient(orgId)
}
