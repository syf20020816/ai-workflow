import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const knowledgeRetrievalExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data
    const collectionName = data.collectionName || ''
    const query = data.query || input.query || ''
    const topK = data.topK || 5
    const scoreThreshold = data.scoreThreshold || 0
    const vectorSize = data.vectorSize || 1536

    const logs: string[] = []
    logs.push(`知识库检索节点开始执行`)
    logs.push(`集合: ${collectionName || '未指定'}`)
    logs.push(`查询: ${query ? query.slice(0, 100) : '未指定'}`)

    if (!collectionName) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { results: [], count: 0, error: '未指定集合名称' },
        logs: [...logs, '未指定集合名称，跳过'],
      }
    }

    if (!query) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { results: [], count: 0, error: '未指定查询文本' },
        logs: [...logs, '未指定查询文本，跳过'],
      }
    }

    try {
      // Step 1: 调用 embedding API 将查询文本转为向量
      logs.push(`正在向量化查询文本...`)
      const embedRes = await fetch('/api/execute/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query }),
      })
      const embedResult = await embedRes.json()

      if (embedResult.status !== 'success') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: { results: [], count: 0 },
          logs: [...logs, `向量化失败: ${embedResult.error}`],
          error: `文本向量化失败: ${embedResult.error}`,
        }
      }

      const vector = embedResult.output.vector
      logs.push(`向量维度: ${embedResult.output.dimensions}`)

      // Step 2: 在 Qdrant 中搜索
      logs.push(`正在搜索集合 ${collectionName}...`)
      const searchRes = await fetch('/api/execute/qdrant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          collectionName,
          vector,
          topK,
          scoreThreshold,
        }),
      })
      const searchResult = await searchRes.json()

      if (searchResult.status !== 'success') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: { results: [], count: 0 },
          logs: [...logs, `搜索失败: ${searchResult.error}`],
          error: `知识库搜索失败: ${searchResult.error}`,
        }
      }

      const results = searchResult.output.results || []
      logs.push(`搜索到 ${results.length} 条结果`)

      // 提取文本内容作为上下文
      const contexts = results.map((r: any) => {
        const payload = r.payload || {}
        return {
          id: r.id,
          score: r.score,
          content: payload.content || payload.text || JSON.stringify(payload),
          ...payload,
        }
      })

      // 拼接检索内容
      const retrievalContent = contexts
        .map((c: any, i: number) => `[结果${i + 1}] (相关度: ${(c.score * 100).toFixed(1)}%)\n${c.content}`)
        .join('\n\n')

      logs.push(`检索内容共 ${retrievalContent.length} 字符`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          results: contexts,
          count: contexts.length,
          retrievalContent,
          collectionName,
          query,
        },
        logs,
      }
    } catch (err: any) {
      logs.push(`知识库检索失败: ${err.message}`)
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { results: [], count: 0 },
        logs,
        error: `知识库检索失败: ${err.message}`,
      }
    }
  },
}
