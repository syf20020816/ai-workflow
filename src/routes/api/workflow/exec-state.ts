import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 执行状态 Checkpoint API（P0-5 断点续跑）
 *
 * 引擎每层执行完成后把 PipelineContext 中的关键状态（nodeOutputs / nodeStatuses /
 * globalStatus / globalMode）序列化到 .pin/exec_state_<workflowId>.json；
 * 再次启动工作流时若检测到 globalStatus === 'paused'，则恢复已完成节点、跳过执行，从断点继续。
 */

const PIN_DIR = path.resolve(process.cwd(), 'workflows', 'result', '.pin')

function ensureDir() {
  if (!fs.existsSync(PIN_DIR)) {
    fs.mkdirSync(PIN_DIR, { recursive: true })
  }
}

function stateFilePath(workflowId: string): string {
  return path.join(PIN_DIR, `exec_state_${workflowId}.json`)
}

export const Route = createFileRoute('/api/workflow/exec-state')({
  server: {
    handlers: {
      /** 读取某个工作流的执行状态（不存在或已损坏返回 404） */
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const workflowId = url.searchParams.get('workflowId')
        if (!workflowId) {
          return Response.json({ error: '缺少 workflowId' }, { status: 400 })
        }
        const filePath = stateFilePath(workflowId)
        if (!fs.existsSync(filePath)) {
          return Response.json({ error: '执行状态不存在' }, { status: 404 })
        }
        try {
          const state = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          return Response.json({ status: 'success', state })
        } catch {
          return Response.json({ error: '执行状态损坏' }, { status: 500 })
        }
      },

      /** 保存执行状态（覆盖同名工作流） */
      POST: async (ctx: any) => {
        ensureDir()
        const body = await ctx.request.json()
        const { workflowId, state } = body
        if (!workflowId || !state) {
          return Response.json({ error: '缺少 workflowId/state' }, { status: 400 })
        }
        fs.writeFileSync(
          stateFilePath(workflowId),
          JSON.stringify(state, null, 2),
        )
        return Response.json({ status: 'success' })
      },

      /** 删除执行状态（执行彻底完成 / 用户重置时） */
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const workflowId = url.searchParams.get('workflowId')
        if (!workflowId) {
          return Response.json({ error: '缺少 workflowId' }, { status: 400 })
        }
        const filePath = stateFilePath(workflowId)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
        return Response.json({ status: 'success' })
      },
    },
  },
})
