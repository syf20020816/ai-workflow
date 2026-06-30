import type { Model } from '#/types/model'
import { create } from 'zustand'

interface ModelState {
  models: Model[]
  loading: boolean
  /** 加载模型列表 */
  fetchModels: () => Promise<void>
  /** 创建模型 */
  createModel: (model: Omit<Model, 'id'>) => Promise<void>
  /** 更新模型 */
  updateModel: (model: Model) => Promise<void>
  /** 删除模型 */
  deleteModel: (id: string) => Promise<void>
}

const API_BASE = '/api/model'

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  loading: false,

  fetchModels: async () => {
    set({ loading: true })
    try {
      const res = await fetch(API_BASE)
      const models: Model[] = await res.json()
      set({ models, loading: false })
    } catch (err) {
      console.error('获取模型列表失败:', err)
      set({ loading: false })
    }
  },

  createModel: async (model) => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model),
      })
      const created: Model = await res.json()
      set({ models: [...get().models, created] })
    } catch (err) {
      console.error('创建模型失败:', err)
    }
  },

  updateModel: async (model) => {
    try {
      await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model),
      })
      set({
        models: get().models.map((m) => (m.id === model.id ? model : m)),
      })
    } catch (err) {
      console.error('更新模型失败:', err)
    }
  },

  deleteModel: async (id) => {
    try {
      await fetch(`${API_BASE}?id=${id}`, { method: 'DELETE' })
      set({ models: get().models.filter((m) => m.id !== id) })
    } catch (err) {
      console.error('删除模型失败:', err)
    }
  },
}))
