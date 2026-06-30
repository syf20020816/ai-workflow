import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import { parseBmadAgents } from '#/engine/bmad/parser'

/** BMad 项目根目录（ai-workflow 的相邻目录） */
const BMAD_ROOT = path.resolve(process.cwd(), '..', 'bmad')
const CONFIG_PATH = path.join(BMAD_ROOT, '_bmad', 'config.toml')
const CUSTOM_CONFIG_PATH = path.join(BMAD_ROOT, '_bmad', 'custom', 'config.toml')

export const Route = createFileRoute('/api/bmad/agents')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const baseContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
          const baseAgents = parseBmadAgents(baseContent)

          // 读取 custom config 叠加
          let customAgents: Array<Record<string, string>> = []
          try {
            const customContent = fs.readFileSync(CUSTOM_CONFIG_PATH, 'utf-8')
            customAgents = parseBmadAgents(customContent)
          } catch {
            // custom config 可能不存在
          }

          // 合并：custom 覆盖 base 的同 id 项，新增的也添加
          const merged = new Map<string, Record<string, string>>()
          for (const a of baseAgents) merged.set(a.id, a)
          for (const a of customAgents) merged.set(a.id, { ...merged.get(a.id), ...a })

          return Response.json([...merged.values()])
        } catch (err: any) {
          return Response.json(
            { error: 'Failed to read BMad config', detail: err.message },
            { status: 500 },
          )
        }
      },
    },
  },
})
