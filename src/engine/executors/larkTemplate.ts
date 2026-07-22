import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const larkTemplateExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const data = config.data
    const templateUrl = data.templateUrl || ''

    const logs: string[] = []
    logs.push(`获取 Lark 模板: ${templateUrl || '未指定'}`)

    if (!templateUrl) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { templateContent: '' },
        logs: [...logs, '未指定模板 URL，跳过'],
      }
    }

    try {
      const res = await fetch('/api/execute/lark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', url: templateUrl, content: '' }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: { templateContent: '' },
          logs: [...logs, ...(result.logs || []), result.error],
          error: result.error,
        }
      }

      // 从 result 中提取文档内容（现在是 Markdown 格式）
      let templateContent = ''
      if (result.output?.result) {
        try {
          const parsed = JSON.parse(result.output.result)
          templateContent = parsed.data?.document?.content || result.output.result
        } catch {
          templateContent = result.output.result
        }
      }

      logs.push(`模板内容已加载 (${templateContent.length} 字符)`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          templateContent,
          templateUrl,
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { templateContent: '' },
        logs: [...logs, `获取模板失败: ${err.message}`],
        error: `获取 Lark 模板失败: ${err.message}`,
      }
    }
  },
}
