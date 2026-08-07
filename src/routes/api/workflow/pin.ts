import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 固定节点（PIN）API
 *
 * 存储结构：.pin/<workflowId>/<nodeType>_<nodeId>.json
 * 以工作流为目录隔离，避免不同工作流中相同 nodeId 互相覆盖。
 * 根目录下仍兼容旧格式文件（无工作流目录的旧 PIN）。
 */

const PIN_ROOT = path.resolve(process.cwd(), 'workflows', 'result', '.pin')

function ensureDir(dir: string = PIN_ROOT) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/** 目录名校验：禁止路径穿越，只保留安全字符集；非法返回空串 */
function safeWorkflowDir(workflowId: string | null | undefined): string {
  if (!workflowId) return ''
  const clean = workflowId.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
  if (!clean || clean.includes('..') || clean.includes('/') || clean.includes('\\')) {
    return ''
  }
  return clean
}

/** 扫描所有包含 PIN 文件的目录（根目录旧数据 + 各工作流子目录），返回目录名列表 */
function listPinDirs(): string[] {
  ensureDir()
  const dirs: string[] = ['']
  for (const entry of fs.readdirSync(PIN_ROOT, { withFileTypes: true })) {
    if (entry.isDirectory()) dirs.push(entry.name)
  }
  return dirs
}

/** 按 nodeType 查找已固定的文件路径；nodeId 存在时精确匹配该节点，否则取该类型保存时间最新的 */
function findPinnedFile(
  nodeType: string,
  nodeId?: string,
  workflowId?: string,
): { filePath: string; workflowId: string } | null {
  const dirs = workflowId ? [safeWorkflowDir(workflowId)] : listPinDirs()
  let latest: { filePath: string; workflowId: string } | null = null
  let latestSavedAt = ''
  for (const dir of dirs) {
    const full = dir ? path.join(PIN_ROOT, dir) : PIN_ROOT
    if (!fs.existsSync(full)) continue
    const files = fs.readdirSync(full).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(full, file), 'utf-8'))
        if (content.nodeType !== nodeType) continue
        if (nodeId) {
          if (content.nodeId === nodeId) {
            return { filePath: path.join(full, file), workflowId: dir }
          }
          continue
        }
        const savedAt = content.savedAt || ''
        if (savedAt >= latestSavedAt) {
          latestSavedAt = savedAt
          latest = { filePath: path.join(full, file), workflowId: dir }
        }
      } catch {
        // skip invalid files
      }
    }
  }
  return latest
}

/** 读取已固定的节点列表（不含完整 output，仅元信息；每个文件一条记录） */
function listPinned(): {
  nodeType: string
  nodeId: string
  title: string
  savedAt: string
  workflowId: string
}[] {
  ensureDir()
  const list: {
    nodeType: string
    nodeId: string
    title: string
    savedAt: string
    workflowId: string
  }[] = []
  for (const dir of listPinDirs()) {
    const full = dir ? path.join(PIN_ROOT, dir) : PIN_ROOT
    const files = fs.readdirSync(full).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(full, file), 'utf-8'))
        // 跳过没有 nodeType 字段的旧格式文件（无法按类型匹配）
        if (!content.nodeType) continue
        list.push({
          nodeType: content.nodeType,
          nodeId: content.nodeId || '',
          title: content.title || content.nodeType,
          savedAt: content.savedAt || '',
          workflowId: dir,
        })
      } catch {
        // skip invalid files
      }
    }
  }
  // 按保存时间倒序
  list.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  return list
}

/** 读取某个固定节点的完整数据（output / context 等） */
function readPinnedData(
  nodeType: string,
  nodeId?: string,
  workflowId?: string,
): Record<string, any> | null {
  const found = findPinnedFile(nodeType, nodeId, workflowId)
  if (!found) return null
  try {
    const data = JSON.parse(fs.readFileSync(found.filePath, 'utf-8'))
    // 补上工作流归属（旧数据可能缺失）
    data.workflowId = data.workflowId || found.workflowId || ''
    return data
  } catch {
    return null
  }
}

/** 删除固定文件；nodeId 存在时只删该节点的文件，否则删除该 nodeType 的所有文件 */
function deletePinned(nodeType: string, nodeId?: string, workflowId?: string) {
  const dirs = workflowId ? [safeWorkflowDir(workflowId)] : listPinDirs()
  for (const dir of dirs) {
    const full = dir ? path.join(PIN_ROOT, dir) : PIN_ROOT
    if (!fs.existsSync(full)) continue
    const files = fs.readdirSync(full).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(full, file), 'utf-8'))
        if (content.nodeType === nodeType && (!nodeId || content.nodeId === nodeId)) {
          fs.unlinkSync(path.join(full, file))
        }
      } catch {
        // skip invalid files
      }
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
        const nodeId = url.searchParams.get('nodeId')
        const workflowId = url.searchParams.get('workflowId')

        // 如果指定了 nodeType，返回完整数据（带 nodeId 时精确匹配该节点，否则取该类型最新一份）
        if (nodeType) {
          const data = readPinnedData(nodeType, nodeId || undefined, workflowId || undefined)
          if (!data) {
            return Response.json({ error: '未找到固定节点数据' }, { status: 404 })
          }
          return Response.json({ status: 'success', data })
        }

        // 否则返回列表
        const list = listPinned()
        return Response.json({ status: 'success', data: list })
      },

      /** 保存固定节点输出（按工作流分目录存储） */
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { nodeType, nodeId, title, output, workflowId, context } = body

        if (!nodeType || !nodeId || !output) {
          return Response.json({ error: '缺少 nodeType/nodeId/output' }, { status: 400 })
        }
        if (!workflowId) {
          return Response.json({ error: '缺少 workflowId' }, { status: 400 })
        }
        const dir = safeWorkflowDir(workflowId)
        if (!dir) {
          return Response.json({ error: '非法 workflowId' }, { status: 400 })
        }

        // 文件名带 nodeId，不同节点各自独立，不会互相覆盖；同一节点重复 pin 时按同名文件自然覆盖
        const savedAt = new Date().toISOString()
        const data = { nodeType, nodeId, title, output, savedAt, workflowId, ...(context ? { context } : {}) }
        ensureDir(path.join(PIN_ROOT, dir))
        fs.writeFileSync(
          path.join(PIN_ROOT, dir, `${nodeType}_${nodeId}.json`),
          JSON.stringify(data, null, 2),
        )

        return Response.json({ status: 'success', data: { savedAt } })
      },

      /** 删除固定节点 */
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const nodeType = url.searchParams.get('nodeType')
        const nodeId = url.searchParams.get('nodeId')
        const workflowId = url.searchParams.get('workflowId')

        if (!nodeType) {
          return Response.json({ error: '缺少 nodeType' }, { status: 400 })
        }

        deletePinned(nodeType, nodeId || undefined, workflowId || undefined)
        return Response.json({ status: 'success' })
      },
    },
  },
})
