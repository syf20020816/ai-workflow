import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

const EXEC_DIR = path.resolve(process.cwd(), 'workflows', 'result', '.exec')

function ensureDir() {
  if (!fs.existsSync(EXEC_DIR)) {
    fs.mkdirSync(EXEC_DIR, { recursive: true })
  }
}

interface ExecHistoryItem {
  workflowId: string
  workflowName: string
  timestamp: string
  status: 'completed' | 'error' | 'paused'
  nodeCount: number
  nodeResults: Array<{
    nodeId: string
    nodeTitle: string
    status: 'success' | 'error' | 'waiting'
    output: Record<string, any>
    error?: string
  }>
  logs: Array<{
    timestamp: number
    nodeId: string
    nodeTitle: string
    level: string
    message: string
  }>
}

export const Route = createFileRoute('/api/workflow/exec-history')({
  server: {
    handlers: {
      /** 列出所有执行历史 */
      GET: async (ctx: any) => {
        ensureDir()
        const url = new URL(ctx.request.url)
        const workflowId = url.searchParams.get('workflowId')
        const filename = url.searchParams.get('filename')

        // 获取单条完整记录
        if (filename) {
          const filePath = path.join(EXEC_DIR, filename)
          if (!fs.existsSync(filePath)) {
            return Response.json({ error: '记录不存在' }, { status: 404 })
          }
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          return Response.json(content)
        }

        // 列出所有
        const files = fs.readdirSync(EXEC_DIR).filter((f) => f.endsWith('.json'))
        let list = files.map((file) => {
          try {
            const content = JSON.parse(fs.readFileSync(path.join(EXEC_DIR, file), 'utf-8'))
            return {
              filename: file,
              workflowId: content.workflowId,
              workflowName: content.workflowName,
              timestamp: content.timestamp,
              status: content.status,
              nodeCount: content.nodeCount,
              nodeResults: content.nodeResults,
            }
          } catch {
            return null
          }
        }).filter(Boolean)

        // 按时间倒序
        list.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))

        // 如果指定了 workflowId，进一步过滤
        if (workflowId) {
          list = list.filter((item: any) => item.workflowId === workflowId)
        }

        return Response.json(list)
      },

      /** 保存执行历史记录 */
      POST: async (ctx: any) => {
        ensureDir()
        const body: ExecHistoryItem = await ctx.request.json()
        const { workflowId, timestamp } = body
        if (!workflowId || !timestamp) {
          return Response.json({ error: '缺少 workflowId/timestamp' }, { status: 400 })
        }
        const filename = `${workflowId}_${timestamp}.json`
        fs.writeFileSync(
          path.join(EXEC_DIR, filename),
          JSON.stringify(body, null, 2),
        )
        return Response.json({ success: true, filename })
      },

      /** 删除执行历史 */
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const filename = url.searchParams.get('filename')
        if (!filename) {
          return Response.json({ error: '缺少 filename' }, { status: 400 })
        }
        const filePath = path.join(EXEC_DIR, filename)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        return Response.json({ success: true })
      },
    },
  },
})
