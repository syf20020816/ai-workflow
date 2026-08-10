import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import { parseBmadAgents } from '#/engine/bmad/parser'

/** BMad 项目根目录（ai-workflow 的相邻目录） */
const BMAD_ROOT = path.resolve(process.cwd(), '.bmad')
const CONFIG_PATH = path.join(BMAD_ROOT, '_bmad', 'config.toml')

/** 转义 TOML 字符串值中的引号与反斜杠 */
function escapeToml(value: unknown): string {
  return String(typeof value === 'string' ? value : '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

export const Route = createFileRoute('/api/bmad/agents')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const baseContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
          return Response.json(parseBmadAgents(baseContent))
        } catch (err: any) {
          return Response.json(
            { error: 'Failed to read BMad config', detail: err.message },
            { status: 500 },
          )
        }
      },

      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { id, module, team, name, title, icon, description } = body

        if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
          return Response.json(
            { error: '角色 ID 只能包含字母、数字和连字符' },
            { status: 400 },
          )
        }
        if (!name || !title) {
          return Response.json(
            { error: 'name 与 title 为必填项' },
            { status: 400 },
          )
        }

        // 防重复：已存在同 id 角色则拒绝
        let existing = ''
        try {
          existing = fs.readFileSync(CONFIG_PATH, 'utf-8')
        } catch { /* 文件可能不存在 */ }

        if (parseBmadAgents(existing).some((a) => a.id === id)) {
          return Response.json(
            { error: `角色 ${id} 已存在` },
            { status: 400 },
          )
        }

        // 追加 [agents.<id>] 段到 config.toml
        const section = [
          '',
          `[agents.${id}]`,
          `module = "${escapeToml(module)}"`,
          `team = "${escapeToml(team)}"`,
          `name = "${escapeToml(name)}"`,
          `title = "${escapeToml(title)}"`,
          icon ? `icon = "${escapeToml(icon)}"` : null,
          `description = "${escapeToml(description)}"`,
        ]
          .filter((l): l is string => l !== null)
          .join('\n')

        const next =
          existing.length === 0
            ? section + '\n'
            : existing.endsWith('\n')
              ? existing + section + '\n'
              : existing + '\n' + section + '\n'

        fs.writeFileSync(CONFIG_PATH, next, 'utf-8')

        return Response.json({ success: true, id })
      },
    },
  },
})
