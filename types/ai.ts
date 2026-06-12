export type AIProviderType = 'openai' | 'anthropic' | 'gemini' | 'custom'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AICompletionOptions {
  model: string
  messages: AIMessage[]
  maxTokens?: number
  temperature?: number
  stream?: boolean
  onToken?: (token: string) => void
  jsonMode?: boolean
}

export interface AICompletionResult {
  content: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  provider: AIProviderType
  durationMs: number
  estimatedCost: number
}

export interface AIProviderClient {
  complete(options: AICompletionOptions): Promise<AICompletionResult>
  testConnection(): Promise<{ ok: boolean; message: string; models?: string[] }>
  provider: AIProviderType
  defaultModel: string
}

// Model costs per 1M tokens (input / output) in USD
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.25, output: 1.25 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model]
  if (!costs) return 0
  return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output
}

export const PROVIDER_MODELS: Record<AIProviderType, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  custom: [],
}
