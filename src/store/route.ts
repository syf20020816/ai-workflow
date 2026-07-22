import { create } from 'zustand'

interface RouteState {
  /** Tabs 的 activeKey */
  activeKey: string
  /** 切换到指定 tab */
  switchTo: (key: string) => void
  /** 待打开的文件路径（用于编辑器 tab） */
  pendingFilePath?: string
  /** 设置待打开的文件路径并切换到编辑器 */
  openInEditor: (filePath: string) => void
  /** 消费 pendingFilePath */
  consumePendingFile: () => void
}

export const useRouteStore = create<RouteState>((set) => ({
  activeKey: 'workflow',
  switchTo: (key: string) => set({ activeKey: key }),
  openInEditor: (filePath: string) =>
    set({ activeKey: 'editor', pendingFilePath: filePath }),
  consumePendingFile: () => set({ pendingFilePath: undefined }),
}))
