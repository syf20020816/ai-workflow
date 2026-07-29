import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const knowledgeStoreExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data
    const collectionName = data.collectionName || ''
    const modelId = data.modelId || ''
    const chunkSize = data.chunkSize || 800
    const chunkOverlap = data.chunkOverlap || 100

    const logs: string[] = []
    logs.push(`知识库写入节点开始执行`)
    logs.push(`目标集合: ${collectionName || '未指定'}`)

    if (!collectionName) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { totalChunks: 0, totalVectors: 0, collectionName },
        logs: [...logs, '未指定集合名称'],
        error: '请选择目标 Qdrant 集合',
      }
    }

    let content = ''
    const contentFields = ['content', 'result', 'text', 'output', 'response', 'analysis']
    for (const field of contentFields) {
      if (input[field] && typeof input[field] === 'string') {
        content = input[field]
        break
      }
    }

    if (!content) {
      for (const val of Object.values(input)) {
        if (typeof val === 'string' && val.length > 0) {
          content = val
          break
        }
      }
    }

    if (!content) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { totalChunks: 0, totalVectors: 0, collectionName },
        logs: [...logs, '上游节点未输出有效文本内容'],
        error: '未获取到待处理的文本内容，请确保上游节点输出文本',
      }
    }

    logs.push(`待处理文本长度: ${content.length} 字符`)

    try {
      logs.push(`正在调用文档处理 API 进行分块和向量化...`)
      const res = await fetch('/api/execute/doc-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName,
          content,
          fileName: `workflow-${config.nodeId}`,
          chunkSize,
          chunkOverlap,
          modelId: modelId || undefined,
        }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: { totalChunks: 0, totalVectors: 0, collectionName },
          logs: [...logs, ...(result.logs || []), result.error || '处理失败'],
          error: result.error || '文档向量化处理失败',
        }
      }

      logs.push(...(result.logs || []))

      const { totalChunks, totalVectors } = result.output || {}
      logs.push(`写入完成: ${totalChunks} 个分块, ${totalVectors} 个向量已写入集合 "${collectionName}"`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          totalChunks,
          totalVectors,
          collectionName,
          success: true,
        },
        logs,
      }
    } catch (err: any) {
      logs.push(`知识库写入失败: ${err.message}`)
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { totalChunks: 0, totalVectors: 0, collectionName },
        logs,
        error: `知识库写入失败: ${err.message}`,
      }
    }
  },
}
