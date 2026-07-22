import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * CodeAgent 节点执行器
 *
 * 调用 Vercel AI SDK 的 API（/api/execute/codeAgent），
 * 由 SDK 自动管理 Tool Calling 循环（工具调用 → 执行 → 回传 → 继续）。
 *
 * 后续扩展工具（命令执行、Git 操作等）只需在 API 端的 tools 对象中添加即可。
 */
export const codeAgentExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const projectPath = config.data.projectPath || ''
    const instruction = config.data.instruction || '请分析这个项目的结构和功能'
    const maxIterations = config.data.maxIterations ?? 20
    const modal = config.data.modal || {}

    const logs: string[] = []
    logs.push(`CodeAgent 开始执行`)
    logs.push(`项目路径: ${projectPath || '未设置（请使用绝对路径）'}`)
    logs.push(`分析指令: ${instruction}`)
    logs.push(`最大迭代次数: ${maxIterations}`)

    if (!modal.name || !modal.url) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '模型配置不完整，请在编辑面板中选择模型'],
        error: '模型配置不完整',
      }
    }

    try {
      const res = await fetch('/api/execute/codeAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath,
          instruction,
          maxIterations,
          modal: {
            url: modal.url,
            apiKey: modal.key,
            modelName: modal.name,
            token: modal.token,
          },
        }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: {},
          logs: [...logs, ...(result.logs || []), result.error],
          error: result.error,
        }
      }

      logs.push(...(result.logs || []))
      logs.push(`CodeAgent 执行完成`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response: result.output.response,
          model: modal.name,
          iterations: result.output.iterations,
          projectPath,
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, `请求失败: ${err.message}`],
        error: `CodeAgent API 调用失败: ${err.message}`,
      }
    }
  },
}
