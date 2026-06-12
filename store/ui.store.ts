import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void

  activeWorkflowRunId: string | null
  setActiveWorkflowRunId: (id: string | null) => void

  globalSearchOpen: boolean
  setGlobalSearchOpen: (v: boolean) => void

  ideaAssistantOpen: boolean
  setIdeaAssistantOpen: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  activeWorkflowRunId: null,
  setActiveWorkflowRunId: (id) => set({ activeWorkflowRunId: id }),

  globalSearchOpen: false,
  setGlobalSearchOpen: (v) => set({ globalSearchOpen: v }),

  ideaAssistantOpen: false,
  setIdeaAssistantOpen: (v) => set({ ideaAssistantOpen: v }),
}))
