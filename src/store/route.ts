import { create } from 'zustand'

interface RouteState {
  /** Tabs 的 activeKey */
  activeKey: string
  /** 切换到指定 tab */
  switchTo: (key: string) => void
}

export const useRouteStore = create<RouteState>((set) => ({
  activeKey: 'workflow',
  switchTo: (key: string) => set({ activeKey: key }),
}))
