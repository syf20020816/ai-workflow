import { createFileRoute } from '@tanstack/react-router'
import { importSkillFromMarkdown, scanMarkdownSkills } from '../skill'

export const Route = createFileRoute('/api/skill/import')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { filePath, dirPath } = body
        const logs: string[] = []

        try {
          if (filePath) {
            if (!filePath.endsWith('.md')) {
              return Response.json({ error: '仅支持导入 .md 文件' }, { status: 400 })
            }

            const skill = await importSkillFromMarkdown(filePath)
            logs.push(`成功导入技能: ${skill.name}`)
            return Response.json({ skill, logs, success: true })
          }

          if (dirPath) {
            const imported = await scanMarkdownSkills(dirPath)
            logs.push(...imported.map((s) => `导入技能: ${s.name}`))
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
