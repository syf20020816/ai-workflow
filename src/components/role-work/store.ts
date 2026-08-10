import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export type RoleStatus = 'idle' | 'working' | 'thinking' | 'success' | 'error'

export type ChatMode = 'private' | 'group'

/** 可序列化的矩形（不依赖 Pixi 类，便于 localStorage 持久化） */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Role {
  id: string
  name: string
  /** 角色 SKILL 指令（系统提示词） */
  skill: string
  status: RoleStatus
  /** 绑定的工位 id；未分配时为 null（角色不出现在画布上） */
  seatId: string | null
  /** 关联的 AI 模型 name（对应 useModelStore.models[].name） */
  modelName: string
  /** 角色在场景图坐标系下的位置（无 seatId 时用于自由放置） */
  x: number
  y: number
  /** 来源 BMad agent id（可选，用于追溯） */
  bmadId?: string
}

export interface Workstation {
  id: string
  /** 工位在场景图（2848×1600）像素坐标系下的位置 */
  x: number
  y: number
  /** 占用该工位的角色 id */
  occupiedBy: string | null
}

/** 场景中已放置的物件（从 office_suite.png 切片而来） */
export interface PlacedItem {
  id: string
  /** 切片在源图中的矩形区域（像素坐标） */
  rect: Rect
  /** 在场景中的 x 坐标（左上角） */
  x: number
  /** 在场景中的 y 坐标（左上角） */
  y: number
  /** 缩放比例 */
  scale: number
}

/** 地板瓷砖：在网格上铺设的地板切片 */
export interface FloorTile {
  id: string
  /** 网格列坐标 */
  gridX: number
  /** 网格行坐标 */
  gridY: number
  /** 切片在 floor.png 中的矩形区域 */
  rect: Rect
}

/** 聊天消息 */
export interface ChatMessage {
  id: string
  /** 会话 id：私聊为 `p:<roleId>`，群聊为 `group` */
  conversationId: string
  /** 作者：用户或角色 */
  author: 'user' | string
  content: string
  status: 'pending' | 'done' | 'error'
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  ts: number
}

/** 放置画笔：null 表示选择模式，否则点击画布会放置对应内容 */
export type PlacementBrush =
  | { type: 'item'; rect: Rect }
  | { type: 'floor'; rect: Rect }
  | { type: 'role'; roleId: string }
  | null

/** 场景持久化数据 */
interface SceneSnapshot {
  sceneItems: PlacedItem[]
  floorTiles: FloorTile[]
  gridSize: number
  rolePositions: { id: string; x: number; y: number; seatId: string | null }[]
}

const SCENE_STORAGE_KEY = 'role-work-scene'

interface RoleWorkState {
  roles: Role[]
  workstations: Workstation[]
  selectedRoleId: string | null
  /** 场景物件列表 */
  sceneItems: PlacedItem[]
  /** 地板瓷砖列表 */
  floorTiles: FloorTile[]
  /** 网格尺寸（像素） */
  gridSize: number
  /** 聊天模式 */
  chatMode: ChatMode
  /** 私聊目标角色 id（chatMode === 'private' 时有效） */
  activePrivateRoleId: string | null
  /** 聊天消息列表 */
  messages: ChatMessage[]
  /** 当前放置画笔 */
  brush: PlacementBrush

  addRole: (data: {
    name: string
    skill: string
    modelName: string
    bmadId?: string
  }) => void
  updateRole: (id: string, patch: Partial<Omit<Role, 'id'>>) => void
  removeRole: (id: string) => void
  selectRole: (id: string | null) => void
  setRoleStatus: (id: string, status: RoleStatus) => void
  setRolePosition: (id: string, x: number, y: number) => void

  addSceneItem: (item: Omit<PlacedItem, 'id'>) => void
  removeSceneItem: (id: string) => void
  clearSceneItems: () => void

  /** 放置地板砖（同网格位置会覆盖） */
  setFloorTile: (tile: Omit<FloorTile, 'id'>) => void
  removeFloorTile: (id: string) => void
  clearFloorTiles: () => void

  setChatMode: (mode: ChatMode) => void
  setActivePrivateRole: (roleId: string | null) => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => string
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void

  setBrush: (brush: PlacementBrush) => void

  /** 保存场景到 localStorage */
  saveScene: () => void
  /** 从 localStorage 加载场景，返回是否成功 */
  loadScene: () => boolean
  /** 是否有已保存的场景 */
  hasSavedScene: () => boolean
}

/** 6 个预设工位，散布在场景中部（3×2 网格） */
const INITIAL_WORKSTATIONS: Workstation[] = [
  { id: 'ws-1', x: 700, y: 500, occupiedBy: null },
  { id: 'ws-2', x: 1400, y: 500, occupiedBy: null },
  { id: 'ws-3', x: 2100, y: 500, occupiedBy: null },
  { id: 'ws-4', x: 700, y: 1050, occupiedBy: null },
  { id: 'ws-5', x: 1400, y: 1050, occupiedBy: null },
  { id: 'ws-6', x: 2100, y: 1050, occupiedBy: null },
]

export const useRoleWorkStore = create<RoleWorkState>((set, get) => ({
  roles: [],
  workstations: INITIAL_WORKSTATIONS,
  selectedRoleId: null,
  sceneItems: [],
  floorTiles: [],
  gridSize: 128,
  chatMode: 'group',
  activePrivateRoleId: null,
  messages: [],
  brush: null,

  addRole: ({ name, skill, modelName, bmadId }) => {
    const id = uuidv4()
    const free = get().workstations.find((w) => w.occupiedBy === null)
    const role: Role = {
      id,
      name,
      skill,
      modelName,
      bmadId,
      status: 'idle',
      seatId: free?.id ?? null,
      x: free?.x ?? 400,
      y: free?.y ?? 400,
    }
    set((s) => ({
      roles: [...s.roles, role],
      workstations: free
        ? s.workstations.map((w) => (w.id === free.id ? { ...w, occupiedBy: id } : w))
        : s.workstations,
    }))
  },

  updateRole: (id, patch) =>
    set((s) => ({ roles: s.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  removeRole: (id) =>
    set((s) => ({
      roles: s.roles.filter((r) => r.id !== id),
      workstations: s.workstations.map((w) =>
        w.occupiedBy === id ? { ...w, occupiedBy: null } : w,
      ),
      selectedRoleId: s.selectedRoleId === id ? null : s.selectedRoleId,
      activePrivateRoleId: s.activePrivateRoleId === id ? null : s.activePrivateRoleId,
    })),

  selectRole: (id) => set({ selectedRoleId: id }),

  setRoleStatus: (id, status) =>
    set((s) => ({ roles: s.roles.map((r) => (r.id === id ? { ...r, status } : r)) })),

  setRolePosition: (id, x, y) =>
    set((s) => ({ roles: s.roles.map((r) => (r.id === id ? { ...r, x, y } : r)) })),

  addSceneItem: (item) =>
    set((s) => ({ sceneItems: [...s.sceneItems, { ...item, id: uuidv4() }] })),

  removeSceneItem: (id) =>
    set((s) => ({ sceneItems: s.sceneItems.filter((i) => i.id !== id) })),

  clearSceneItems: () => set({ sceneItems: [] }),

  setFloorTile: (tile) =>
    set((s) => {
      // 同网格位置覆盖：移除旧的，添加新的
      const filtered = s.floorTiles.filter(
        (t) => !(t.gridX === tile.gridX && t.gridY === tile.gridY),
      )
      return { floorTiles: [...filtered, { ...tile, id: uuidv4() }] }
    }),

  removeFloorTile: (id) =>
    set((s) => ({ floorTiles: s.floorTiles.filter((t) => t.id !== id) })),

  clearFloorTiles: () => set({ floorTiles: [] }),

  setChatMode: (mode) => set({ chatMode: mode }),

  setActivePrivateRole: (roleId) => set({ activePrivateRoleId: roleId }),

  addMessage: (msg) => {
    const id = uuidv4()
    const ts = Date.now()
    set((s) => ({ messages: [...s.messages, { ...msg, id, ts }] }))
    return id
  },

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  setBrush: (brush) => set({ brush }),

  saveScene: () => {
    const { sceneItems, floorTiles, gridSize, roles } = get()
    const snapshot: SceneSnapshot = {
      sceneItems,
      floorTiles,
      gridSize,
      rolePositions: roles.map((r) => ({ id: r.id, x: r.x, y: r.y, seatId: r.seatId })),
    }
    try {
      localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(snapshot))
    } catch (err) {
      console.error('保存场景失败:', err)
    }
  },

  loadScene: () => {
    try {
      const raw = localStorage.getItem(SCENE_STORAGE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as Partial<SceneSnapshot>
      set({
        sceneItems: data.sceneItems ?? [],
        floorTiles: data.floorTiles ?? [],
        gridSize: data.gridSize ?? 128,
      })
      // 恢复角色位置（仅对仍存在的角色生效）
      const { rolePositions } = data
      if (rolePositions) {
        set((s) => ({
          roles: s.roles.map((r) => {
            const saved = rolePositions.find((p) => p.id === r.id)
            return saved ? { ...r, x: saved.x, y: saved.y, seatId: saved.seatId } : r
          }),
        }))
      }
      return true
    } catch (err) {
      console.error('加载场景失败:', err)
      return false
    }
  },

  hasSavedScene: () => {
    try {
      return localStorage.getItem(SCENE_STORAGE_KEY) !== null
    } catch {
      return false
    }
  },
}))
