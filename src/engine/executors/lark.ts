import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * Lark 文档节点执行器
 * 调用后端 API 执行真实的 lark-cli 命令。
 */
export const larkExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const data = config.data

    const action = data.action || 'read'
    const url = data.url || ''

    // 内容优先使用节点自身配置，若为空则从上游输入中提取
    let content = data.content || ''
    if (!content && action === 'write') {
      // 按优先级查找上游输出中的内容字段
      const contentFields = ['analysis', 'response', 'content', 'result', 'output', 'text']
      for (const field of contentFields) {
        if (ctx.input[field]) {
          content = String(ctx.input[field])
          break
        }
      }
      // 兜底：取第一个非空字符串值
      if (!content) {
        for (const val of Object.values(ctx.input)) {
          if (typeof val === 'string' && val) {
            content = val
            break
          }
        }
      }
    }

    const logs: string[] = []
    logs.push(`Lark ${action} 操作: ${url || '新建文档'}`)

    try {
      const res = await fetch('/api/execute/lark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, url, content }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: { action, url, success: false },
          logs: [...logs, ...(result.logs || []), result.error],
          error: result.error,
        }
      }

      logs.push(...(result.logs || []))

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          result: result.output.result,
          action,
          url,
          success: true,
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { action, url, success: false },
        logs: [...logs, `请求失败: ${err.message}`],
        error: `Lark 操作失败: ${err.message}`,
      }
    }
  },
}
