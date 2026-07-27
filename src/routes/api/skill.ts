import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import type { Skill } from '#/types/skill'

const SKILLS_DIR = path.resolve(process.cwd(), 'workflows/skills')
const INDEX_PATH = path.join(SKILLS_DIR, 'index.json')

/** 确保 skills 目录存在 */
function ensureDir(): void {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true })
  }
}

/** 读取技能索引（不包含 content） */
function readIndex(): Skill[] {
  ensureDir()
  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, '[]')
    return []
  }
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'))
}

/** 写入技能索引 */
function writeIndex(skills: Skill[]): void {
  ensureDir()
  fs.writeFileSync(INDEX_PATH, JSON.stringify(skills, null, 2))
}

/** 获取某个技能的 skill.md 路径 */
function skillContentPath(skillId: string): string {
  return path.join(SKILLS_DIR, skillId, 'skill.md')
}

/** 保存技能内容到 skill.md */
function saveSkillContent(skillId: string, content: string): void {
  const dir = path.dirname(skillContentPath(skillId))
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(skillContentPath(skillId), content || '', 'utf-8')
}

/** 读取 skill.md 内容 */
function readSkillContent(skillId: string): string | null {
  const fp = skillContentPath(skillId)
  if (!fs.existsSync(fp)) return null
  return fs.readFileSync(fp, 'utf-8')
}

/** 删除技能目录（包括 skill.md） */
function deleteSkillDir(skillId: string): void {
  const dir = path.dirname(skillContentPath(skillId))
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** 解析 SKILL.md 的 YAML front matter，提取 name/description */
function parseSkillFrontMatter(content: string): { name?: string; description?: string } {
  const lines = content.split('\n')
  if (lines.length < 2 || lines[0].trim() !== '---') return {}
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end === -1) return {}
  const fm: Record<string, string> = {}
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^(\w+):\s*(.+)/)
    if (m) fm[m[1]] = m[2].replace(/^>-\s*/, '').trim()
  }
  return { name: fm.name, description: fm.description }
}

/** 重新扫描 skills 目录，同步 index.json */
function rescanIndex(): Skill[] {
  const index = readIndex()
  const originalJson = JSON.stringify(index)
  const indexMap = new Map<string, Skill>()
  for (const s of index) indexMap.set(s.id, s)

  // 扫描所有子目录
  let dirEntries: fs.Dirent[] = []
  try {
    dirEntries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  } catch {
    // skills 目录不存在
  }

  const foundIds = new Set<string>()

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue
    const skillMdPath = path.join(SKILLS_DIR, entry.name, 'SKILL.md')
    if (!fs.existsSync(skillMdPath)) continue

    foundIds.add(entry.name)

    // 已存在索引中，跳过
    if (indexMap.has(entry.name)) continue

    // 新增条目
    const content = fs.readFileSync(skillMdPath, 'utf-8')
    const fm = parseSkillFrontMatter(content)
    const skill: Skill = {
      id: entry.name,
      name: fm.name || entry.name,
      description: fm.description || `skill: ${entry.name}`,
      source: 'custom',
    }
    index.push(skill)
  }

  // 移除已不存在的条目
  const cleaned = index.filter((s) => foundIds.has(s.id))

  // 有变化时才写入（对比原始快照，而非已变异的 index）
  if (JSON.stringify(cleaned) !== originalJson) {
    writeIndex(cleaned)
  }

  return cleaned
}

export const Route = createFileRoute('/api/skill')({
  server: {
    handlers: {
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const rescan = url.searchParams.get('rescan') === 'true'
        const index = rescan ? rescanIndex() : readIndex()
        return Response.json(index)
      },
      POST: async (ctx: any) => {
        const body: Skill = await ctx.request.json()
        const index = readIndex()

        body.id = body.id || crypto.randomUUID()

        // 保存 content 到 skill.md，从索引中移除 systemPrompt 字段
        const content = body.systemPrompt || ''
        delete (body as any).systemPrompt
        saveSkillContent(body.id, content)

        index.push(body)
        writeIndex(index)
        return Response.json(body, { status: 201 })
      },
      PUT: async (ctx: any) => {
        const body: Skill = await ctx.request.json()
        const index = readIndex()
        const idx = index.findIndex((s) => s.id === body.id)
        if (idx === -1) {
          return Response.json({ error: 'Skill not found' }, { status: 404 })
        }

        // 更新 content 到 skill.md
        const content = body.systemPrompt || ''
        delete (body as any).systemPrompt
        saveSkillContent(body.id, content)

        index[idx] = body
        writeIndex(index)
        return Response.json(index[idx])
      },
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')
        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }
        const index = readIndex()
        writeIndex(index.filter((s) => s.id !== id))
        deleteSkillDir(id)
        return Response.json({ success: true })
      },
    },
  },
})

// ---- 导出辅助函数供其他路由使用 ----

/**
 * 从 Markdown 文件导入技能
 * 写入到 workflows/skills/{skillName}/skill.md 并更新索引
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
    source: 'markdown',
    filePath,
  }

  // 直接写入目录结构
  saveSkillContent(skill.id, content)

  // 添加到索引
  const index = readIndex()
  index.push(skill)
  writeIndex(index)

  return skill
}

/**
 * 扫描目录中的 .md 文件并批量导入为技能
 */
export async function scanMarkdownSkills(dirPath: string): Promise<Skill[]> {
  const resolvedDir = path.resolve(process.cwd(), dirPath)

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

/** 按 id 读取技能内容（从 skill.md） */
export async function getSkillContentById(id: string): Promise<string | null> {
  return readSkillContent(id)
}
