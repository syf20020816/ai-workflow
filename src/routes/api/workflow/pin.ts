import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

const RESULTS_DIR = path.resolve(process.cwd(), 'workflows', 'result')

function ensureDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
  }
}

/** 读取已固定的节点列表（不含完整 output，仅元信息） */
function listPinned(workflowId: string): { nodeId: string; title: string; savedAt: string }[] {
  ensureDir()
  const prefix = `${workflowId}_`
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
  const list: { nodeId: string; title: string; savedAt: string }[] = []
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'))
      list.push({
        nodeId: content.nodeId,
        title: content.title || file,
        savedAt: content.savedAt || '',
      })
    } catch {
      // skip invalid files
    }
  }
  // 按保存时间倒序
  list.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  return list
}

/** 读取某个固定节点的完整输出 */
function readPinnedOutput(workflowId: string, nodeId: string): Record<string, any> | null {
  const filePath = path.join(RESULTS_DIR, `${workflowId}_${nodeId}.json`)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/workflow/pin')({
  server: {
    handlers: {
      /** 列出/读取固定节点 */
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const workflowId = url.searchParams.get('workflowId')
        const nodeId = url.searchParams.get('nodeId')

        if (!workflowId) {
          return Response.json({ error: '缺少 workflowId 参数' }, { status: 400 })
        }

        // 如果指定了 nodeId，返回完整输出
        if (nodeId) {
          const data = readPinnedOutput(workflowId, nodeId)
          if (!data) {
            return Response.json({ error: '未找到固定节点数据' }, { status: 404 })
          }
          return Response.json({ status: 'success', data })
        }

        // 否则返回列表
        const list = listPinned(workflowId)
        return Response.json({ status: 'success', data: list })
      },

      /** 保存固定节点输出 */
      POST: async (ctx: any) => {
        ensureDir()
        const body = await ctx.request.json()
        const { workflowId, nodeId, title, output } = body

        if (!workflowId || !nodeId || !output) {
          return Response.json({ error: '缺少 workflowId/nodeId/output' }, { status: 400 })
        }

        const savedAt = new Date().toISOString()
        const data = { workflowId, nodeId, title, output, savedAt }
        fs.writeFileSync(
          path.join(RESULTS_DIR, `${workflowId}_${nodeId}.json`),
          JSON.stringify(data, null, 2),
        )

        return Response.json({ status: 'success', data: { savedAt } })
      },

      /** 删除固定节点 */
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const workflowId = url.searchParams.get('workflowId')
        const nodeId = url.searchParams.get('nodeId')

        if (!workflowId || !nodeId) {
          return Response.json({ error: '缺少 workflowId 或 nodeId' }, { status: 400 })
        }

        const filePath = path.join(RESULTS_DIR, `${workflowId}_${nodeId}.json`)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }

        return Response.json({ status: 'success' })
      },
    },
  },
})
