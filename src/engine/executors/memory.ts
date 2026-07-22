import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * Memory 节点执行器
 * 读取 memory/memory.md 文件内容，作为上下文传递给下游节点。
 */
export const memoryExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const memoryPath = config.data.memoryPath || 'memory/memory.md'

    const logs: string[] = []
    logs.push(`Memory 节点开始执行`)
    logs.push(`记忆文件: ${memoryPath}`)

    try {
      const res = await fetch(`/api/editor/content?path=${encodeURIComponent(memoryPath)}`)
      const result = await res.json()

      if (result.status === 'success') {
        logs.push(`成功读取记忆文件`)

        return {
          nodeId: config.nodeId,
          status: 'success',
          output: {
            content: result.data.content,
            memoryPath,
          },
          logs,
        }
      }

      // 文件不存在也返回空内容，不报错
      logs.push(`记忆文件不存在或为空，返回空内容`)
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          content: '',
          memoryPath,
        },
        logs,
      }
    } catch (err: any) {
      logs.push(`读取记忆失败: ${err.message}`)
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs,
        error: `Memory 节点执行失败: ${err.message}`,
      }
    }
  },
}
