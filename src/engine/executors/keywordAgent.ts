import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const keywordAgentExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data
    const modal = data.modal
    const format = data.format || '{\n  "keywords": string[]\n}'

    const logs: string[] = []
    logs.push(`关键词提取节点开始执行`)

    if (!modal?.name || !modal?.url) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { keywords: [] },
        logs: [...logs, '未配置模型，跳过'],
      }
    }

    // 从上游输入中提取内容
    const upstreamContent =
      input.content ||
      input.text ||
      input.instruction ||
      input.retrievalContent ||
      input.result ||
      input.prompt ||
      input.query ||
      Object.values(input).find((v: any) => typeof v === 'string' && v.length > 50) ||
      ''

    if (!upstreamContent) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { keywords: [] },
        logs: [...logs, '上游内容为空，跳过'],
      }
    }

    logs.push(`获取上游内容: ${(upstreamContent as string).slice(0, 80)}...`)
    logs.push(`模型: ${modal.name}`)
    logs.push(`正在调用 AI 提取关键词...`)

    try {
      const res = await fetch('/api/execute/keywordAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upstreamContent,
          format,
          modal,
          nodeId: config.nodeId,
        }),
      })

      const result = await res.json()

      if (result.status !== 'success') {
        throw new Error(result.error || '关键词提取失败')
      }

      const { keywords = [], queries = [] } = result.output || {}
      logs.push(`提取到 ${keywords.length} 个关键词`)
      if (keywords.length > 0) {
        logs.push(`关键词: ${keywords.slice(0, 10).join(', ')}${keywords.length > 10 ? '...' : ''}`)
      }

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          keywords,
          queries,
          raw: result.output?.raw,
        },
        logs,
      }
    } catch (err: any) {
      logs.push(`关键词提取失败: ${err.message}`)
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { keywords: [] },
        logs,
        error: `关键词提取失败: ${err.message}`,
      }
    }
  },
}
