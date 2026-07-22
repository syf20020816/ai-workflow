import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import type { Skill } from '#/types/skill'

const DATA_PATH = path.resolve(process.cwd(), 'skill.conf.json')

export const Route = createFileRoute('/api/skill/content')({
  server: {
    handlers: {
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')

        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }

        const skills: Skill[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
        const skill = skills.find((s) => s.id === id)

        if (!skill) {
          return Response.json({ error: 'Skill not found' }, { status: 404 })
        }

        let content = skill.systemPrompt || ''

        // 如果是 markdown 来源，从文件重新读取
        if (skill.source === 'markdown' && skill.filePath) {
          const resolvedPath = path.resolve(process.cwd(), skill.filePath)
          if (fs.existsSync(resolvedPath)) {
            content = fs.readFileSync(resolvedPath, 'utf-8')
          }
        }

        return Response.json({ content, skill })
      },
    },
  },
})
