import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

const RESULTS_DIR = path.resolve(process.cwd(), 'workflows', 'result', '.pin')

function ensureDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
  }
}

/** 按 nodeType 查找已固定的文件路径（同一 nodeType 只会保留一份） */
function findPinnedFile(nodeType: string): string | null {
  ensureDir()
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'))
      if (content.nodeType === nodeType) return path.join(RESULTS_DIR, file)
    } catch {
      // skip invalid files
    }
  }
  return null
}

/** 读取已固定的节点列表（不含完整 output，仅元信息） */
function listPinned(): { nodeType: string; title: string; savedAt: string }[] {
  ensureDir()
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'))
  const list: { nodeType: string; title: string; savedAt: string }[] = []
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'))
      // 跳过没有 nodeType 字段的旧格式文件（无法按类型匹配）
      if (!content.nodeType) continue
      list.push({
        nodeType: content.nodeType,
        title: content.title || content.nodeType,
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
function readPinnedOutput(nodeType: string): Record<string, any> | null {
  const filePath = findPinnedFile(nodeType)
  if (!filePath) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

/** 删除某个 nodeType 的所有固定文件 */
function deletePinned(nodeType: string) {
  ensureDir()
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'))
      if (content.nodeType === nodeType) {
        fs.unlinkSync(path.join(RESULTS_DIR, file))
      }
    } catch {
      // skip invalid files
    }
  }
}

export const Route = createFileRoute('/api/workflow/pin')({
  server: {
    handlers: {
      /** 列出/读取固定节点 */
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const nodeType = url.searchParams.get('nodeType')

        // 如果指定了 nodeType，返回完整输出
        if (nodeType) {
          const data = readPinnedOutput(nodeType)
          if (!data) {
            return Response.json({ error: '未找到固定节点数据' }, { status: 404 })
          }
          return Response.json({ status: 'success', data })
        }

        // 否则返回列表
        const list = listPinned()
        return Response.json({ status: 'success', data: list })
      },

      /** 保存固定节点输出 */
      POST: async (ctx: any) => {
        ensureDir()
        const body = await ctx.request.json()
        const { nodeType, nodeId, title, output } = body

        if (!nodeType || !nodeId || !output) {
          return Response.json({ error: '缺少 nodeType/nodeId/output' }, { status: 400 })
        }

        // 同一 nodeType 只保留一份：先删除旧的，再保存新的
        deletePinned(nodeType)

        const savedAt = new Date().toISOString()
        const data = { nodeType, nodeId, title, output, savedAt }
        fs.writeFileSync(
          path.join(RESULTS_DIR, `${nodeType}_${nodeId}.json`),
          JSON.stringify(data, null, 2),
        )

        return Response.json({ status: 'success', data: { savedAt } })
      },

      /** 删除固定节点 */
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const nodeType = url.searchParams.get('nodeType')

        if (!nodeType) {
          return Response.json({ error: '缺少 nodeType' }, { status: 400 })
        }

        deletePinned(nodeType)
        return Response.json({ status: 'success' })
      },
    },
  },
})
