import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const larkWikiTraversalExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const data = config.data

    const spaceUrl = data.spaceUrl || ''
    const maxDocs = data.maxDocs || 200

    const logs: string[] = []
    logs.push(`Lark 知识库遍历节点开始执行`)
    logs.push(`知识库链接: ${spaceUrl || '未指定'}`)

    if (!spaceUrl) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { totalDocs: 0, documents: [] },
        logs: [...logs, '未指定知识库链接'],
        error: '请填写 Lark 知识库链接',
      }
    }

    try {
      logs.push(`正在调用知识库遍历 API...`)
      const res = await fetch('/api/execute/larkWikiTraversal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceUrl,
          maxDocs,
        }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: { totalDocs: 0, documents: [] },
          logs: [...logs, ...(result.logs || []), result.error || '处理失败'],
          error: result.error || '知识库遍历失败',
        }
      }

      logs.push(...(result.logs || []))

      const { totalDocs, documents } = result.output || {}
      const totalChars = (documents || []).reduce((sum: number, d: any) => sum + (d.content?.length || 0), 0)
      logs.push(`遍历完成: 共 ${totalDocs || 0} 个文档, 合计 ${totalChars} 字符`)

      // 将文档列表和拼接文本一起输出，下游 knowledgeStore 可消费
      const allContent = (documents || []).map((d: any) => d.content).join('\n\n---\n\n')

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          totalDocs,
          documents: documents || [],
          content: allContent,
        },
        logs,
      }
    } catch (err: any) {
      logs.push(`知识库遍历失败: ${err.message}`)
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { totalDocs: 0, documents: [] },
        logs,
        error: `知识库遍历失败: ${err.message}`,
      }
    }
  },
}
