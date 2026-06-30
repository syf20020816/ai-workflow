import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import type { Skill } from '#/types/skill'

const DATA_PATH = path.resolve(process.cwd(), 'skill.conf.json')

function readSkills(): Skill[] {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
}

function writeSkills(skills: Skill[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(skills, null, 2))
}

export const Route = createFileRoute('/api/skill')({
  server: {
    handlers: {
      GET: async () => {
        const skills = readSkills()
        return Response.json(skills)
      },
      POST: async (ctx: any) => {
        const body: Skill = await ctx.request.json()
        const skills = readSkills()
        body.id = body.id || crypto.randomUUID()
        skills.push(body)
        writeSkills(skills)
        return Response.json(body, { status: 201 })
      },
      PUT: async (ctx: any) => {
        const body: Skill = await ctx.request.json()
        const skills = readSkills()
        const idx = skills.findIndex((s) => s.id === body.id)
        if (idx === -1) {
          return Response.json({ error: 'Skill not found' }, { status: 404 })
        }
        skills[idx] = body
        writeSkills(skills)
        return Response.json(skills[idx])
      },
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')
        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }
        const skills = readSkills()
        writeSkills(skills.filter((s) => s.id !== id))
        return Response.json({ success: true })
      },
    },
  },
})
