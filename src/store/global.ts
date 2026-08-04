import { create } from 'zustand'

interface GlobalState {
  // 全局模式
  globalMode: 'normal' | 'spec'
  setGlobalMode: (mode: 'normal' | 'spec') => void
  isStepMenuOpen: boolean;
  setIsStepMenuOpen: (open: boolean) => void
}

export const useGlobalStore = create<GlobalState>((set) => ({
  globalMode: 'normal',
  setGlobalMode: (mode) => set({ globalMode: mode }),
  isStepMenuOpen: true,
  setIsStepMenuOpen: (open) => set({ isStepMenuOpen: open }),
}))
