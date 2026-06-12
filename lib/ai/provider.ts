import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import type { AIProviderClient, AICompletionOptions, AICompletionResult, AIProviderType } from '@/types/ai'
import { estimateCost } from '@/types/ai'

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
    if (process.env.ANTHROPIC_API_KEY) return createAIClient('anthropic', process.env.ANTHROPIC_API_KEY, 'claude-sonnet-4-6')
    if (process.env.OPENAI_API_KEY) return createAIClient('openai', process.env.OPENAI_API_KEY, 'gpt-4o-mini')
    throw new Error('No active LLM configuration found. Please configure an LLM provider in Settings > LLM Configuration.')
  }

  const apiKey = decrypt(config.apiKeyEncrypted, config.iv)
  return createAIClient(config.provider.toLowerCase() as AIProviderType, apiKey, config.defaultModel)
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
    return createAIClient(roleConfig.provider.toLowerCase() as AIProviderType, apiKey, roleConfig.defaultModel)
  }

  // Fall back to default active config
  return getAIClient(orgId)
}
