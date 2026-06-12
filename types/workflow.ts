import type { AIProviderClient } from './ai'

export interface WorkflowStepDefinition {
  name: string
  required?: boolean
  execute(opts: {
    ctx: WorkflowContext
    aiClient: AIProviderClient
    previousResults: Record<string, WorkflowStepResult>
  }): Promise<WorkflowStepResult>
}

export interface WorkflowContext {
  orgId: string
  userId?: string
  params?: Record<string, string>
  onStepUpdate?: (event: { stepName: string; status: string; output?: string }) => void
}

export interface WorkflowStepResult {
  summary?: string
  tokensUsed?: number
  estimatedCost?: number
  data?: unknown
}

export interface WorkflowDefinition {
  type: string
  steps: WorkflowStepDefinition[]
}

export interface WorkflowProgressEvent {
  runId: string
  stepName: string
  status: string
  output?: string
  tokensUsed?: number
}
