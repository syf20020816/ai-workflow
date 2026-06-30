import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * 回答节点执行器
 * 暂停执行，等待用户输入后再继续。
 * 在当前阶段返回 waiting 状态，由 UI 层处理用户输入后恢复。
 */
export const answerExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, globalContext } = ctx
    const data = config.data

    // 检查全局上下文中是否有针对此节点的用户回复
    const userReply = (globalContext as any).userInputs?.[config.nodeId]

    if (userReply !== undefined) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          question: data.question || '',
          reply: userReply,
          options: data.options || [],
        },
        logs: [`用户回答了问题: ${userReply}`],
      }
    }

    // 无回复，返回 waiting 状态，请求用户输入
    return {
      nodeId: config.nodeId,
      status: 'waiting',
      output: {
        question: data.question || '请输入...',
        options: data.options || [],
      },
      logs: ['等待用户输入...'],
    }
  },
}
