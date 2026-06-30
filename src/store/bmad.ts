import { create } from 'zustand'
import type { BmadAgent } from '#/types/bmad'

interface BmadAgentState {
  agents: BmadAgent[]
  loading: boolean
  fetchAgents: () => Promise<void>
}

export const useBmadAgentStore = create<BmadAgentState>((set) => ({
  agents: [],
  loading: false,

  fetchAgents: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/bmad/agents')
      const agents: BmadAgent[] = await res.json()
      set({ agents, loading: false })
    } catch (err) {
      console.error('获取 BMad 角色列表失败:', err)
      set({ loading: false })
    }
  },
}))
