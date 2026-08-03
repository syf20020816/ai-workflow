import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import { stripNodesModals } from '#/services/modal'

const WORKFLOWS_DIR = path.resolve(process.cwd(), 'workflows')
const VERSIONS_DIR = path.join(WORKFLOWS_DIR, '.versions')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

interface VersionInfo {
  versionId: string
  createdAt: string
  nodeCount: number
  edgeCount: number
}

export const Route = createFileRoute('/api/workflow/versions')({
  server: {
    handlers: {
      /** 列出工作流的所有版本 */
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')
        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }

        const versionDir = path.join(VERSIONS_DIR, id)
        ensureDir(versionDir)

        const files = fs.readdirSync(versionDir)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .reverse() // 最新的在前

        const versions: VersionInfo[] = files.map((f) => {
          const content = JSON.parse(
            fs.readFileSync(path.join(versionDir, f), 'utf-8'),
          )
          const versionId = f.replace('.json', '')
          return {
            versionId,
            createdAt: content.savedAt || '',
            nodeCount: content.nodes?.length || 0,
            edgeCount: content.edges?.length || 0,
          }
        })

        return Response.json({ versions })
      },

      /** 保存版本快照 */
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { id, data } = body

        if (!id || !data) {
          return Response.json({ error: 'Missing id or data' }, { status: 400 })
        }

        const versionDir = path.join(VERSIONS_DIR, id)
        ensureDir(versionDir)

        const now = new Date().toISOString()
        const versionId = `v-${Date.now()}`
        const snapshot = {
          ...data,
          // 快照同样只存模型引用，不落 API Key
          nodes: stripNodesModals(data.nodes || []),
          savedAt: now,
          versionId,
        }

        fs.writeFileSync(
          path.join(versionDir, `${versionId}.json`),
          JSON.stringify(snapshot, null, 2),
        )

        return Response.json({ versionId, savedAt: now, success: true })
      },

      /** 恢复指定版本 */
      PUT: async (ctx: any) => {
        const body = await ctx.request.json()
        const { workflowId, versionId } = body

        if (!workflowId || !versionId) {
          return Response.json({ error: 'Missing workflowId or versionId' }, { status: 400 })
        }

        const snapshotPath = path.join(VERSIONS_DIR, workflowId, `${versionId}.json`)
        if (!fs.existsSync(snapshotPath)) {
          return Response.json({ error: 'Version not found' }, { status: 404 })
        }

        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'))

        // 恢复：用版本快照覆盖工作流文件（同样只写模型引用）
        const workflowPath = path.join(WORKFLOWS_DIR, `${workflowId}.json`)
        const workflow = {
          name: snapshot.name || workflowId,
          id: workflowId,
          nodes: stripNodesModals(snapshot.nodes || []),
          edges: snapshot.edges || [],
          createdAt: snapshot.createdAt || now(),
          updatedAt: now(),
        }
        fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2))

        return Response.json({ success: true })
      },

      /** 删除指定版本 */
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')
        const versionId = url.searchParams.get('versionId')
        if (!id || !versionId) {
          return Response.json({ error: 'Missing id or versionId' }, { status: 400 })
        }

        const snapshotPath = path.join(VERSIONS_DIR, id, `${versionId}.json`)
        // 路径穿越防护：校验解析后的路径必须位于版本目录内
        const resolved = path.resolve(snapshotPath)
        if (!resolved.startsWith(path.resolve(VERSIONS_DIR))) {
          return Response.json({ error: 'Invalid path' }, { status: 400 })
        }
        if (!fs.existsSync(snapshotPath)) {
          return Response.json({ error: 'Version not found' }, { status: 404 })
        }
        fs.unlinkSync(snapshotPath)

        return Response.json({ success: true })
      },
    },
  },
})

function now(): string {
  return new Date().toISOString()
}
