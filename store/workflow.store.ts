import { create } from 'zustand'

type WorkflowStatus = string

interface WorkflowStep {
  id: string
  name: string
  status: WorkflowStatus
  tokensUsed: number
  startedAt?: string
  completedAt?: string
}

interface ActiveWorkflow {
  runId: string
  type: string
  status: WorkflowStatus
  steps: WorkflowStep[]
  totalTokens: number
  startedAt: string
}

interface WorkflowStore {
  activeRun: ActiveWorkflow | null
  setActiveRun: (run: ActiveWorkflow | null) => void
  updateStep: (runId: string, stepId: string, update: Partial<WorkflowStep>) => void
  updateRunStatus: (runId: string, status: WorkflowStatus, totalTokens?: number) => void
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  activeRun: null,
  setActiveRun: (run) => set({ activeRun: run }),
  updateStep: (runId, stepId, update) =>
    set((s) => {
      if (!s.activeRun || s.activeRun.runId !== runId) return s
      return {
        activeRun: {
          ...s.activeRun,
          steps: s.activeRun.steps.map((step) =>
            step.id === stepId ? { ...step, ...update } : step
          ),
        },
      }
    }),
  updateRunStatus: (runId, status, totalTokens) =>
    set((s) => {
      if (!s.activeRun || s.activeRun.runId !== runId) return s
      return {
        activeRun: { ...s.activeRun, status, ...(totalTokens !== undefined ? { totalTokens } : {}) },
      }
    }),
}))
