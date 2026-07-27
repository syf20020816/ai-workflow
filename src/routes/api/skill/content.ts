import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import type { Skill } from '#/types/skill'

const INDEX_PATH = path.resolve(process.cwd(), 'workflows/skills/index.json')
const SKILLS_DIR = path.resolve(process.cwd(), 'workflows/skills')

export const Route = createFileRoute('/api/skill/content')({
  server: {
    handlers: {
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')

        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }

        if (!fs.existsSync(INDEX_PATH)) {
          return Response.json({ error: 'No skills found' }, { status: 404 })
        }

        const skills: Skill[] = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))
        const skill = skills.find((s) => s.id === id)

        if (!skill) {
          return Response.json({ error: 'Skill not found' }, { status: 404 })
        }

        // 从 workflows/skills/{id}/SKILL.md 读取内容
        const skillMdPath = path.join(SKILLS_DIR, id, 'SKILL.md')
        let content = ''
        if (fs.existsSync(skillMdPath)) {
          content = fs.readFileSync(skillMdPath, 'utf-8')
        }

        return Response.json({ content, skill })
      },
    },
  },
})
