import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * Lark 文档节点执行器
 * 后续对接 lark-cli 命令。
 */
export const larkExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const data = config.data

    const action = data.action || 'read'
    const url = data.url || ''
    const content = data.content || ''

    // Phase 1: 模拟 Lark CLI 调用
    const result =
      action === 'read'
        ? `[模拟] 读取飞书文档: ${url}\n内容: 这是模拟的飞书文档内容示例...`
        : action === 'write'
          ? `[模拟] 已写入飞书文档: ${url}\n写入内容长度: ${content.length} 字符`
          : `[模拟] 已创建新飞书文档`

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        result,
        action,
        url,
        success: true,
      },
      logs: [`Lark ${action} 操作完成: ${url || '新建文档'}`],
    }
  },
}
