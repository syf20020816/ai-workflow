import { create } from 'zustand'

interface GlobalState {
  // 全局模式
  globalMode: 'normal' | 'spec'
  setGlobalMode: (mode: 'normal' | 'spec') => void
}

export const useGlobalStore = create<GlobalState>((set) => ({
  globalMode: 'normal',
  setGlobalMode: (mode) => set({ globalMode: mode }),
}))
