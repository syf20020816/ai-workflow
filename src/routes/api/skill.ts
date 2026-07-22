import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import type { Skill } from '#/types/skill'

const DATA_PATH = path.resolve(process.cwd(), 'skill.conf.json')

function readSkills(): Skill[] {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, '[]')
    return []
  }
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

/**
 * 从 Markdown 文件导入技能
 * 解析文件内容作为 systemPrompt，文件名作为技能名
 */
export async function importSkillFromMarkdown(filePath: string): Promise<Skill> {
  const resolvedPath = path.resolve(process.cwd(), filePath)

  // 路径穿越检测
  const resolved = path.resolve(resolvedPath)
  if (!resolved.startsWith(process.cwd())) {
    throw new Error('文件路径不在工作目录范围内')
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8')
  const name = path.basename(filePath, '.md')

  const skill: Skill = {
    id: crypto.randomUUID(),
    name,
    description: `从 ${filePath} 导入的技能`,
    systemPrompt: content,
    source: 'markdown',
    filePath,
  }

  return skill
}

/**
 * 扫描目录中的 .md 文件并批量导入为技能
 */
export async function scanMarkdownSkills(dirPath: string): Promise<Skill[]> {
  const resolvedDir = path.resolve(process.cwd(), dirPath)

  // 路径穿越检测
  if (!resolvedDir.startsWith(process.cwd())) {
    throw new Error('目录路径不在工作目录范围内')
  }

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`目录不存在: ${dirPath}`)
  }

  const files = fs.readdirSync(resolvedDir)
  const mdFiles = files.filter((f) => f.endsWith('.md'))

  const skills: Skill[] = []
  for (const file of mdFiles) {
    const fullPath = path.join(resolvedDir, file)
    const skill = await importSkillFromMarkdown(fullPath)
    skills.push(skill)
  }

  return skills
}

export async function readSkillContent(id: string): Promise<string | null> {
  const skills = readSkills()
  const skill = skills.find((s) => s.id === id)
  if (!skill) return null

  // 如果是 markdown 来源，从文件重新读取
  if (skill.source === 'markdown' && skill.filePath) {
    const resolvedPath = path.resolve(process.cwd(), skill.filePath)
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, 'utf-8')
    }
  }

  return skill.systemPrompt || null
}
