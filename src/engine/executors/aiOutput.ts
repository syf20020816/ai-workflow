import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * AI 输出节点执行器
 * 仅透传上游输出，作为工作流终点。
 */
export const aiOutputExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        content: (input as any).response || (input as any).analysis || (input as any).result || JSON.stringify(input),
        sourceAgent: config.data.sourceAgent || '',
        ...input,
      },
      logs: ['输出节点处理完成'],
    }
  },
}
