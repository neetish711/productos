import { create } from 'zustand'

interface SpecState {
  // Per-spec content keyed by specId
  contents: Record<string, string>
  dirty: Record<string, boolean>

  setContent: (specId: string, content: string) => void
  setDirty: (specId: string, isDirty: boolean) => void
  resetDirty: (specId: string) => void

  // Convenience helpers for single active spec
  content: (specId: string) => string | undefined
  isDirty: (specId: string) => boolean
}

export const useSpecStore = create<SpecState>((set, get) => ({
  contents: {},
  dirty: {},

  setContent: (specId, content) =>
    set(s => ({ contents: { ...s.contents, [specId]: content } })),

  setDirty: (specId, isDirty) =>
    set(s => ({ dirty: { ...s.dirty, [specId]: isDirty } })),

  resetDirty: (specId) =>
    set(s => ({ dirty: { ...s.dirty, [specId]: false } })),

  content: (specId) => get().contents[specId],
  isDirty: (specId) => get().dirty[specId] ?? false,
}))
