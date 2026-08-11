import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'role-work-state'

function loadFromStorage(): Partial<RoleWorkState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return {
      roles: parsed.roles ?? [],
      selectedRoleId: parsed.selectedRoleId ?? null,
      chatMode: parsed.chatMode ?? 'group',
      activePrivateRoleId: parsed.activePrivateRoleId ?? null,
      messages: parsed.messages ?? [],
    }
  } catch {
    return {}
  }
}

function saveToStorage(state: Pick<RoleWorkState, 'roles' | 'selectedRoleId' | 'chatMode' | 'activePrivateRoleId' | 'messages'>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export type RoleStatus = 'idle' | 'working' | 'thinking' | 'success' | 'error'

export type ChatMode = 'private' | 'group'

export interface Role {
  id: string
  name: string
  /** 角色 SKILL 指令（系统提示词） */
  skill: string
  status: RoleStatus
  /** 关联的 AI 模型 name（对应 useModelStore.models[].name） */
  modelName: string
  /** 来源 BMad agent id（可选，用于追溯） */
  bmadId?: string
  /** 精灵图索引 0-5，用于角色卡片头像显示 */
  spriteIndex: number
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

interface RoleWorkState {
  roles: Role[]
  selectedRoleId: string | null
  /** 聊天模式 */
  chatMode: ChatMode
  /** 私聊目标角色 id（chatMode === 'private' 时有效） */
  activePrivateRoleId: string | null
  /** 聊天消息列表 */
  messages: ChatMessage[]

  addRole: (data: {
    name: string
    skill: string
    modelName: string
    bmadId?: string
    spriteIndex?: number
  }) => void
  updateRole: (id: string, patch: Partial<Omit<Role, 'id'>>) => void
  removeRole: (id: string) => void
  selectRole: (id: string | null) => void
  setRoleStatus: (id: string, status: RoleStatus) => void

  setChatMode: (mode: ChatMode) => void
  setActivePrivateRole: (roleId: string | null) => void
  addMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => string
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void
}

const initialState = {
  roles: [],
  selectedRoleId: null,
  chatMode: 'group' as ChatMode,
  activePrivateRoleId: null as string | null,
  messages: [],
}

const persisted = loadFromStorage()

export const useRoleWorkStore = create<RoleWorkState>((set) => ({
  ...initialState,
  ...persisted,

  addRole: ({ name, skill, modelName, bmadId, spriteIndex = 0 }) => {
    const id = uuidv4()
    const role: Role = {
      id,
      name,
      skill,
      modelName,
      bmadId,
      status: 'idle',
      spriteIndex,
    }
    set((s) => {
      const next = { roles: [...s.roles, role] }
      saveToStorage({ ...s, ...next })
      return next
    })
  },

  updateRole: (id, patch) =>
    set((s) => {
      const next = { roles: s.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
      saveToStorage({ ...s, ...next })
      return next
    }),

  removeRole: (id) =>
    set((s) => {
      const next = {
        roles: s.roles.filter((r) => r.id !== id),
        selectedRoleId: s.selectedRoleId === id ? null : s.selectedRoleId,
        activePrivateRoleId: s.activePrivateRoleId === id ? null : s.activePrivateRoleId,
      }
      saveToStorage({ ...s, ...next })
      return next
    }),

  selectRole: (id) =>
    set((s) => {
      const next = { selectedRoleId: id }
      saveToStorage({ ...s, ...next })
      return next
    }),

  setRoleStatus: (id, status) =>
    set((s) => {
      const next = { roles: s.roles.map((r) => (r.id === id ? { ...r, status } : r)) }
      saveToStorage({ ...s, ...next })
      return next
    }),

  setChatMode: (mode) =>
    set((s) => {
      const next = { chatMode: mode }
      saveToStorage({ ...s, ...next })
      return next
    }),

  setActivePrivateRole: (roleId) =>
    set((s) => {
      const next = { activePrivateRoleId: roleId }
      saveToStorage({ ...s, ...next })
      return next
    }),

  addMessage: (msg) => {
    const id = uuidv4()
    const ts = Date.now()
    set((s) => {
      const next = { messages: [...s.messages, { ...msg, id, ts }] }
      saveToStorage({ ...s, ...next })
      return next
    })
    return id
  },

  updateMessage: (id, patch) =>
    set((s) => {
      const next = {
        messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }
      saveToStorage({ ...s, ...next })
      return next
    }),
}))
