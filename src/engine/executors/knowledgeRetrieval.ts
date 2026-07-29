import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const knowledgeRetrievalExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data

    // 支持新旧两种字段：collectionNames（多集合） / collectionName（兼容单集合）
    const collectionNames: string[] =
      data.collectionNames?.length
        ? data.collectionNames
        : data.collectionName
          ? [data.collectionName]
          : []

    const query = data.query || input.query || ''
    const topK = data.topK || 5
    const scoreThreshold = data.scoreThreshold || 0
    const filters: Array<{ field: string; match: string }> = data.filters || []

    const logs: string[] = []
    logs.push(`知识库检索节点开始执行`)
    logs.push(`目标集合: ${collectionNames.length > 0 ? collectionNames.join(', ') : '未指定'}`)
    logs.push(`查询: ${query ? query.slice(0, 100) : '未指定'}`)
    if (filters.length > 0) {
      logs.push(`筛选条件: ${filters.map((f) => `${f.field}=${f.match}`).join(', ')}`)
    }

    if (collectionNames.length === 0) {
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

      // 构建筛选条件 Qdrant filter
      const qdrantFilter: Record<string, any> | undefined =
        filters.length > 0
          ? {
              must: filters
                .filter((f) => f.field && f.match)
                .map((f) => ({
                  key: f.field,
                  match: { value: f.match },
                })),
            }
          : undefined

      // Step 2: 遍历所有集合搜索
      const allResults: Array<{
        id: string | number
        score: number
        payload?: Record<string, any>
        collectionName: string
      }> = []

      for (const name of collectionNames) {
        logs.push(`正在搜索集合 ${name}...`)
        const searchRes = await fetch('/api/execute/qdrant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'search',
            collectionName: name,
            vector,
            topK,
            scoreThreshold,
            filter: qdrantFilter,
          }),
        })
        const searchResult = await searchRes.json()

        if (searchResult.status !== 'success') {
          logs.push(`集合 "${name}" 搜索失败: ${searchResult.error}`)
          continue
        }

        const results = (searchResult.output.results || []).map((r: any) => ({
          ...r,
          collectionName: name,
        }))
        logs.push(`  集合 "${name}" 返回 ${results.length} 条结果`)
        allResults.push(...results)
      }

      // Step 3: 合并结果，按分数降序排列
      allResults.sort((a, b) => b.score - a.score)
      const mergedResults = allResults.slice(0, topK)

      logs.push(`共搜索到 ${allResults.length} 条结果，合并后取前 ${mergedResults.length} 条`)

      // 提取文本内容作为上下文
      const contexts = mergedResults.map((r: any) => {
        const payload = r.payload || {}
        return {
          id: r.id,
          score: r.score,
          source: r.collectionName,
          content: payload.content || payload.text || JSON.stringify(payload),
          ...payload,
        }
      })

      // 拼接检索内容
      const retrievalContent = contexts
        .map(
          (c: any, i: number) =>
            `[结果${i + 1}] (相关度: ${(c.score * 100).toFixed(1)}%, 来源: ${c.source})\n${c.content}`,
        )
        .join('\n\n')

      logs.push(`检索内容共 ${retrievalContent.length} 字符`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          results: contexts,
          count: contexts.length,
          retrievalContent,
          collectionNames,
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
