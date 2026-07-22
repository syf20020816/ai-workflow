import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import type { Skill } from '#/types/skill'

const SKILL_DATA_PATH = path.resolve(process.cwd(), 'skill.conf.json')

function readSkills(): Skill[] {
  if (!fs.existsSync(SKILL_DATA_PATH)) {
    fs.writeFileSync(SKILL_DATA_PATH, '[]')
    return []
  }
  return JSON.parse(fs.readFileSync(SKILL_DATA_PATH, 'utf-8'))
}

function writeSkills(skills: Skill[]): void {
  fs.writeFileSync(SKILL_DATA_PATH, JSON.stringify(skills, null, 2))
}

export const Route = createFileRoute('/api/skill/import')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { filePath, dirPath } = body
        const logs: string[] = []

        try {
          if (filePath) {
            // 导入单个 markdown 文件
            const resolvedPath = path.resolve(process.cwd(), filePath)
            if (!resolvedPath.startsWith(process.cwd())) {
              return Response.json({ error: '文件路径不在工作目录范围内' }, { status: 400 })
            }
            if (!fs.existsSync(resolvedPath)) {
              return Response.json({ error: `文件不存在: ${filePath}` }, { status: 400 })
            }
            if (!filePath.endsWith('.md')) {
              return Response.json({ error: '仅支持导入 .md 文件' }, { status: 400 })
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

            const skills = readSkills()
            skills.push(skill)
            writeSkills(skills)

            logs.push(`成功导入技能: ${name}`)
            return Response.json({ skill, logs, success: true })
          }

          if (dirPath) {
            // 扫描目录批量导入
            const resolvedDir = path.resolve(process.cwd(), dirPath)
            if (!resolvedDir.startsWith(process.cwd())) {
              return Response.json({ error: '目录路径不在工作目录范围内' }, { status: 400 })
            }
            if (!fs.existsSync(resolvedDir)) {
              return Response.json({ error: `目录不存在: ${dirPath}` }, { status: 400 })
            }

            const files = fs.readdirSync(resolvedDir)
            const mdFiles = files.filter((f) => f.endsWith('.md'))

            const imported: Skill[] = []
            const skills = readSkills()

            for (const file of mdFiles) {
              const fullPath = path.join(resolvedDir, file)
              const content = fs.readFileSync(fullPath, 'utf-8')
              const name = path.basename(file, '.md')

              const skill: Skill = {
                id: crypto.randomUUID(),
                name,
                description: `从 ${path.join(dirPath, file)} 导入的技能`,
                systemPrompt: content,
                source: 'markdown',
                filePath: path.join(dirPath, file),
              }

              skills.push(skill)
              imported.push(skill)
              logs.push(`导入技能: ${name}`)
            }

            writeSkills(skills)
            logs.push(`共导入 ${imported.length} 个技能`)
            return Response.json({ skills: imported, logs, success: true })
          }

          return Response.json({ error: '请提供 filePath 或 dirPath' }, { status: 400 })
        } catch (err: any) {
          return Response.json({ error: `导入失败: ${err.message}` }, { status: 500 })
        }
      },
    },
  },
})
