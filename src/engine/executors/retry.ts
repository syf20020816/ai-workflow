import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * retryNode 执行器
 * 处理错误重试逻辑。
 * 
 * 执行逻辑：
 * 1. 接收上游节点的输出
 * 2. 检查上游是否标记了错误或异常
 * 3. 人工判断模式：检查 output 中是否包含配置的关键词
 * 4. AI 判断模式：将上游输出传给连接的 AgentNode 做判断
 * 5. 如果判断为错误，标记 _shouldRetry: true
 * 
 * 注意：当前引擎线性执行，重试需要引擎在发现 _shouldRetry 时重新执行。
 * 此执行器正确标记需要重试的情况，为引擎提供决策依据。
 */
export const retryExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const judgmentMode: 'manual' | 'ai' = config.data.judgmentMode || 'manual'
    const retryDelay = config.data.retryDelay ?? 1
    const maxRetryCount = config.data.maxRetryCount ?? 5
    const errorKeywords: string = config.data.errorKeywords || ''

    const logs: string[] = []

    // 检查上游输出是否包含错误信息
    const upstreamText = JSON.stringify(input).toLowerCase()
    const hasErrorUpstream = input.error || input.status === 'error'

    let isError = false

    if (judgmentMode === 'manual' && errorKeywords) {
      // 人工判断：关键词匹配
      const keywords = errorKeywords.split(/[,，]/).map((k: string) => k.trim().toLowerCase()).filter(Boolean)
      const matched = keywords.filter((k: string) => upstreamText.includes(k))
      if (matched.length > 0) {
        isError = true
        logs.push(`人工判断触发重试: 匹配到关键词 [${matched.join(', ')}]`)
      } else {
        logs.push('人工判断: 未匹配到错误关键词，继续执行')
      }
    } else if (judgmentMode === 'ai') {
      // AI判断：由上游 AgentNode 处理，当前检查上游是否有 _aiError 标记
      isError = !!(input as any)._aiRetryError
      if (isError) {
        logs.push('AI 判断触发重试')
      } else {
        logs.push('AI 判断: 无需重试')
      }
    }

    // 也检查显式的 error 状态
    if (hasErrorUpstream) {
      isError = true
      logs.push('上游节点执行错误，触发重试')
    }

    if (isError) {
      logs.push(`将在 ${retryDelay}s 后重试，最多重试 ${maxRetryCount} 次`)
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          ...input,
          _shouldRetry: true,
          _retryDelay: retryDelay,
          _maxRetryCount: maxRetryCount,
          _fromRetryNode: true,
          _retryError: input.error || input,
        },
        logs,
      }
    }

    // 无需重试，透传上游数据
    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        ...input,
        _shouldRetry: false,
        _fromRetryNode: true,
      },
      logs,
    }
  },
}
