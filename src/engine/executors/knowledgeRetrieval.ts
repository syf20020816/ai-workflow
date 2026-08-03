import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { callAI } from '#/services/ai'

/** 调用嵌入 API 将文本转为向量 */
async function doEmbed(text: string): Promise<{ vector: number[]; dimensions: number }> {
  const res = await fetch('/api/execute/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const result = await res.json()
  if (result.status !== 'success') {
    throw new Error(result.error || '向量化失败')
  }
  return { vector: result.output.vector, dimensions: result.output.dimensions }
}

/** 搜索单个集合 */
async function searchCollection(
  collectionName: string,
  vector: number[],
  topK: number,
  scoreThreshold: number,
  filter?: Record<string, any>,
): Promise<any[]> {
  const res = await fetch('/api/execute/qdrant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'search',
      collectionName,
      vector,
      topK,
      scoreThreshold,
      filter,
    }),
  })
  const result = await res.json()
  if (result.status !== 'success') {
    throw new Error(result.error || '搜索失败')
  }
  return (result.output.results || []).map((r: any) => ({ ...r, collectionName }))
}

/** 调用 AI 生成搜索查询 */
async function generateQueries(
  context: string,
  maxRetrievals: number,
  modal: { name: string; key: string; url: string },
  logs: string[],
): Promise<string[]> {
  // 从 prompts/keywordAgent.md 加载系统提示词，支持通过「规则与模型」页面自定义
  let basePrompt = `You are a knowledge base search query generator. Given a user's text, generate diverse, concise search queries to find relevant information in a vector database.`
  try {
    const res = await fetch('/api/prompts?name=keywordAgent.md')
    const data = await res.json()
    if (data.status === 'success' && data.data?.content) {
      basePrompt = data.data.content
    }
  } catch {
    // 使用默认提示词
  }
  // 附加输出格式指令，确保解析兼容
  const systemPrompt = `${basePrompt}\n\nOutput format:\n- Generate up to ${maxRetrievals} queries, one per line\n- Do NOT number the queries\n- Do NOT add any explanation or commentary\n- Output ONLY the queries, one per line`

  logs.push(`正在调用 AI 生成搜索查询...`)

  const userText = `Generate search queries for the following context:\n\n${context.slice(0, 3000)}`

  let content: string
  try {
    const result = await callAI({
      model: {
        name: modal.name,
        key: modal.key,
        url: modal.url,
      },
      systemPrompt,
      prompt: userText,
      temperature: 0.7,
    })
    content = result.text
  } catch (err: any) {
    throw new Error(`AI 调用失败: ${err.message}`)
  }

  const queries = content
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0 && !l.startsWith('#') && !l.startsWith('-'))

  logs.push(`AI 生成了 ${queries.length} 个查询语句${queries.length > 0 ? `: ${queries.slice(0, 3).map((q: string) => `"${q.slice(0, 40)}"`).join(', ')}${queries.length > 3 ? `...等` : ''}` : ''}`)
  return queries.slice(0, maxRetrievals)
}

/** 对一批查询语句逐条执行向量化+搜索，聚合结果 */
async function executeMultiSearch(
  queries: string[],
  collectionNames: string[],
  topK: number,
  scoreThreshold: number,
  qdrantFilter: Record<string, any> | undefined,
  maxRetrievals: number,
  logs: string[],
): Promise<any[]> {
  const allResults: any[] = []
  let searchCount = 0

  for (const q of queries) {
    searchCount++
    if (searchCount > maxRetrievals) break

    const shortQ = q.length > 50 ? q.slice(0, 50) + '...' : q
    logs.push(`[${searchCount}/${queries.length}] 搜索: "${shortQ}"`)

    try {
      const { vector } = await doEmbed(q)

      for (const name of collectionNames) {
        try {
          const results = await searchCollection(name, vector, topK, scoreThreshold, qdrantFilter)
          allResults.push(...results)
        } catch (e: any) {
          logs.push(`  集合 "${name}" 搜索失败: ${e.message}`)
        }
      }
    } catch (e: any) {
      logs.push(`  查询 "${shortQ}" 向量化失败: ${e.message}`)
    }
  }

  logs.push(`完成 ${searchCount} 次检索`)
  return allResults
}

/** 清洗检索结果，只保留 score 和 content，其余字段丢弃 */
function cleanResults(results: any[]): { score: number; content: string }[] {
  return results.map((r) => ({
    score: r.score ?? 0,
    content: r.payload?.content || r.payload?.text || '',
  }))
}

/** 将检索结果去重、排序、格式化为文本 */
function formatResults(allResults: any[], logs: string[]): string {
  // 第一层去重：按 collectionName:id 去重
  const seen = new Set<string>()
  const unique: any[] = []
  for (const r of allResults) {
    const key = `${r.collectionName}:${r.id}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(r)
    }
  }

  // 第二层去重：内容包含去重 — 若一条结果的内容是另一条的完整子串，保留较长的
  const contentDeduped = unique
    .map((r) => ({
      ...r,
      _content: (r.payload?.content || r.payload?.text || '').trim(),
    }))
    .filter((r) => r._content.length > 0)
  contentDeduped.sort((a, b) => b.score - a.score)

  const filtered: typeof contentDeduped = []
  for (const r of contentDeduped) {
    let isContained = false
    for (const existing of filtered) {
      // 检查 r 的内容是否被已保留的结果包含，或包含已保留的结果
      if (existing._content.includes(r._content)) {
        isContained = true
        break
      }
      if (r._content.includes(existing._content)) {
        // r 更长，替换掉已有的较短结果
        existing._content = r._content
        existing.payload = r.payload
        existing.score = r.score
        isContained = true
        break
      }
    }
    if (!isContained) {
      filtered.push(r)
    }
  }

  filtered.sort((a, b) => b.score - a.score)
  logs.push(`共检索到 ${allResults.length} 条结果，ID去重后 ${unique.length} 条，内容去重后 ${filtered.length} 条`)

  return filtered
    .map(
      (r: any, i: number) =>
        `[结果${i + 1}] (相关度: ${(r.score * 100).toFixed(1)}%, 来源: ${r.collectionName})\n${r._content}`,
    )
    .join('\n\n')
}

export const knowledgeRetrievalExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data

    // 支持新旧两种字段：collectionNames（多集合）/ collectionName（兼容单集合）
    const collectionNames: string[] =
      data.collectionNames?.length
        ? data.collectionNames
        : data.collectionName
          ? [data.collectionName]
          : []

    const query = data.query || input.query || ''
    const queriesFromInput: string[] = Array.isArray(input.queries) ? input.queries : []
    const topK = data.topK || 5
    const scoreThreshold = data.scoreThreshold || 0
    const maxRetrievals = data.maxRetrievals || 40
    const modal = data.modal
    const filters: Array<{ field: string; match: string }> = data.filters || []

    const logs: string[] = []
    logs.push(`知识库检索节点开始执行`)
    logs.push(`目标集合: ${collectionNames.length > 0 ? collectionNames.join(', ') : '未指定'}`)

    if (collectionNames.length === 0) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { results: [], count: 0, error: '未指定集合名称' },
        logs: [...logs, '未指定集合名称，跳过'],
      }
    }

    // 检查是否有任何查询来源
    const hasExplicitQuery = !!query
    const hasQueriesList = queriesFromInput.length > 0
    const hasAutoMode = !!modal?.url

    if (!hasExplicitQuery && !hasQueriesList && !hasAutoMode) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { results: [], count: 0, error: '未指定查询文本，上游未提供查询列表，也未配置 AI 模型' },
        logs: [...logs, '无法检索：未指定查询文本，上游未提供查询列表，也未配置 AI 模型'],
      }
    }

    // 构建 Qdrant 筛选条件
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

    // ============================================================
    // 模式 A：显式提供 query → 单次搜索（向后兼容）
    // ============================================================
    if (hasExplicitQuery) {
      logs.push(`使用指定查询文本: ${query.slice(0, 100)}`)

      try {
        logs.push(`正在向量化查询文本...`)
        const { vector, dimensions } = await doEmbed(query)
        logs.push(`向量维度: ${dimensions}`)

        const allResults: any[] = []
        for (const name of collectionNames) {
          logs.push(`正在搜索集合 ${name}...`)
          try {
            const results = await searchCollection(name, vector, topK, scoreThreshold, qdrantFilter)
            logs.push(`  集合 "${name}" 返回 ${results.length} 条结果`)
            allResults.push(...results)
          } catch (e: any) {
            logs.push(`  集合 "${name}" 搜索失败: ${e.message}`)
          }
        }

        const retrievalContent = formatResults(allResults, logs)
        logs.push(`检索内容共 ${retrievalContent.length} 字符`)

        return {
          nodeId: config.nodeId,
          status: 'success',
          output: {
            results: cleanResults(allResults),
            count: allResults.length,
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
    }

    // ============================================================
    // 模式 C：上游提供 queries 数组 → 逐条搜索
    // ============================================================
    if (hasQueriesList) {
      logs.push(`从上游获取 ${queriesFromInput.length} 个查询语句`)

      try {
        const allResults = await executeMultiSearch(
          queriesFromInput, collectionNames, topK, scoreThreshold, qdrantFilter, maxRetrievals, logs,
        )

        const retrievalContent = formatResults(allResults, logs)
        logs.push(`检索内容共 ${retrievalContent.length} 字符`)

        return {
          nodeId: config.nodeId,
          status: 'success',
          output: {
            results: cleanResults(allResults),
            count: allResults.length,
            retrievalContent,
            collectionNames,
            queriesGenerated: queriesFromInput,
            queryCount: queriesFromInput.length,
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
    }

    // ============================================================
    // 模式 B：自动模式 — AI 根据上游上下文生成多种查询，多次检索
    // ============================================================
    try {
      const context = input.content || input.text || input.instruction || input.query || input.prompt || input.result || Object.values(input).find(v => typeof v === 'string' && v.length > 50) || ''

      if (!context) {
        return {
          nodeId: config.nodeId,
          status: 'success',
          output: { results: [], count: 0, error: '上游无上下文输入' },
          logs: [...logs, '上游无上下文输入，跳过'],
        }
      }

      logs.push(`从上游获取上下文: ${context.slice(0, 100)}...`)

      const queries = await generateQueries(context, maxRetrievals, modal, logs)

      if (queries.length === 0) {
        logs.push('AI 未生成有效查询，跳过检索')
        return {
          nodeId: config.nodeId,
          status: 'success',
          output: { results: [], count: 0, retrievalContent: '', collectionNames },
          logs,
        }
      }

      const allResults = await executeMultiSearch(
        queries, collectionNames, topK, scoreThreshold, qdrantFilter, maxRetrievals, logs,
      )

      const retrievalContent = formatResults(allResults, logs)
      logs.push(`检索内容共 ${retrievalContent.length} 字符`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          results: cleanResults(allResults),
          count: allResults.length,
          retrievalContent,
          collectionNames,
          queriesGenerated: queries,
          queryCount: queries.length,
        },
        logs,
      }
    } catch (err: any) {
      logs.push(`知识库自动检索失败: ${err.message}`)
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { results: [], count: 0 },
        logs,
        error: `知识库自动检索失败: ${err.message}`,
      }
    }
  },
}
