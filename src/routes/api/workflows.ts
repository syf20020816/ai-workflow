import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

const WORKFLOWS_DIR = path.resolve(process.cwd(), 'workflows')

function ensureDir() {
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    fs.mkdirSync(WORKFLOWS_DIR, { recursive: true })
  }
}

interface WorkflowMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  nodeCount: number
  edgeCount: number
}

export const Route = createFileRoute('/api/workflows')({
  server: {
    handlers: {
      /** 列出所有工作流模板 */
      GET: async () => {
        ensureDir()
        const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.json'))
        const workflows: WorkflowMeta[] = files.map((file) => {
          const content = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8'))
          return {
            id: file.replace('.json', ''),
            name: content.name || file.replace('.json', ''),
            createdAt: content.createdAt || '',
            updatedAt: content.updatedAt || '',
            nodeCount: content.nodes?.length || 0,
            edgeCount: content.edges?.length || 0,
          }
        })
        // 按更新时间排序，最新的在前
        workflows.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
        return Response.json(workflows)
      },

      /** 保存工作流模板 */
      POST: async (ctx: any) => {
        ensureDir()
        const body = await ctx.request.json()
        const { name, nodes, edges } = body

        if (!name || !nodes || !edges) {
          return Response.json({ error: '缺少 name/nodes/edges' }, { status: 400 })
        }

        const now = new Date().toISOString()
        const id = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
        const workflow = {
          name,
          id,
          nodes,
          edges,
          createdAt: now,
          updatedAt: now,
        }

        fs.writeFileSync(
          path.join(WORKFLOWS_DIR, `${id}.json`),
          JSON.stringify(workflow, null, 2),
        )

        return Response.json({ id, name, success: true }, { status: 201 })
      },

      /** 删除工作流模板 */
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')
        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }
        const filePath = path.join(WORKFLOWS_DIR, `${id}.json`)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        return Response.json({ success: true })
      },
    },
  },
})
