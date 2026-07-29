import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

const WORKFLOWS_DIR = path.resolve(process.cwd(), 'workflows')
const VERSIONS_DIR = path.join(WORKFLOWS_DIR, '.versions')

function ensureDir() {
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    fs.mkdirSync(WORKFLOWS_DIR, { recursive: true })
  }
}

function ensureVersionsDir(id: string) {
  const dir = path.join(VERSIONS_DIR, id)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

interface WorkflowMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  nodeCount: number
  edgeCount: number
  hasKnowledgeStore: boolean
}

export const Route = createFileRoute('/api/workflows')({
  server: {
    handlers: {
      /** 列出所有工作流模板 / 获取单条完整工作流 */
      GET: async (ctx: any) => {
        ensureDir()
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')

        // 获取单条完整工作流（含 nodes/edges）
        if (id) {
          const filePath = path.join(WORKFLOWS_DIR, `${id}.json`)
          if (!fs.existsSync(filePath)) {
            return Response.json({ error: '工作流不存在' }, { status: 404 })
          }
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          return Response.json(content)
        }

        // 列出所有工作流模板
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
            hasKnowledgeStore: (content.nodes || []).some((n: any) => n.type === 'knowledgeStore'),
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
        const workflowFile = path.join(WORKFLOWS_DIR, `${id}.json`)

        // 如果已存在相同 ID 的工作流，先保存版本快照
        if (fs.existsSync(workflowFile)) {
          try {
            const existing = JSON.parse(fs.readFileSync(workflowFile, 'utf-8'))
            ensureVersionsDir(id)
            const versionId = `v-${Date.now()}`
            const snapshot = {
              name: existing.name,
              id: existing.id,
              nodes: existing.nodes,
              edges: existing.edges,
              savedAt: now,
              versionId,
            }
            fs.writeFileSync(
              path.join(VERSIONS_DIR, id, `${versionId}.json`),
              JSON.stringify(snapshot, null, 2),
            )
          } catch {
            // 版本快照保存失败不影响本次保存
          }
        }

        const workflow = {
          name,
          id,
          nodes,
          edges,
          createdAt: now,
          updatedAt: now,
        }

        fs.writeFileSync(workflowFile, JSON.stringify(workflow, null, 2))

        return Response.json({ id, name, success: true }, { status: 201 })
      },

      /** 删除工作流模板（同时删除对应的版本记录） */
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
        // 删除版本历史目录
        const versionDir = path.join(VERSIONS_DIR, id)
        if (fs.existsSync(versionDir)) {
          fs.rmSync(versionDir, { recursive: true, force: true })
        }
        return Response.json({ success: true })
      },
    },
  },
})
