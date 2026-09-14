import type { Skill } from '#/types/skill'
import { create } from 'zustand'

interface SkillState {
  skills: Skill[]
  loading: boolean
  fetchSkills: () => Promise<void>
  createSkill: (skill: Omit<Skill, 'id'>) => Promise<void>
  updateSkill: (skill: Skill) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
}

const API_BASE = '/api/skill'

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  loading: false,

  fetchSkills: async () => {
    set({ loading: true })
    try {
      // rescan=true：先扫描 workflows/skills/ 目录，把 file-editor 等直接新建的
      // SKILL.md 目录同步进 index.json，再返回最新列表
      const res = await fetch(`${API_BASE}?rescan=true`)
      const skills: Skill[] = await res.json()
      set({ skills, loading: false })
    } catch (err) {
      console.error('获取技能列表失败:', err)
      set({ loading: false })
    }
  },

  createSkill: async (skill) => {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skill),
      })
      const created: Skill = await res.json()
      set({ skills: [...get().skills, created] })
    } catch (err) {
      console.error('创建技能失败:', err)
    }
  },

  updateSkill: async (skill) => {
    try {
      await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skill),
      })
      set({
        skills: get().skills.map((s) => (s.id === skill.id ? skill : s)),
      })
    } catch (err) {
      console.error('更新技能失败:', err)
    }
  },

  deleteSkill: async (id) => {
    try {
      await fetch(`${API_BASE}?id=${id}`, { method: 'DELETE' })
      set({ skills: get().skills.filter((s) => s.id !== id) })
    } catch (err) {
      console.error('删除技能失败:', err)
    }
  },
}))
