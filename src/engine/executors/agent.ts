import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * 智能体节点执行器
 * 目前返回占位结果，后续对接真实 AI API。
 */
export const agentExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const modal = config.data.modal || {}

    const inputText =
      (input as any).text || (input as any).prompt || JSON.stringify(input)

    // Phase 1: 模拟 AI 调用
    const result = `[模拟] 智能体 "${modal.alias || modal.name || '未命名'}" 处理完成\n输入: ${inputText.slice(0, 100)}`

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        response: result,
        model: modal.name,
        usage: { promptTokens: inputText.length, completionTokens: result.length },
      },
      logs: [`智能体 ${modal.alias || config.data.title} 执行完成`],
    }
  },
}
