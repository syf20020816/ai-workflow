import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { buildBudgetedContext } from '#/services/upstreamContext'
import { startAgentCli, pollAgentCliTask } from '#/services/runner'

/** 从 CLI 输出中宽松解析 JSON（容错代码块包裹、前后杂文本） */
function parseLooseJson(text: string): any | null {
  // 优先整体解析
  try {
    return JSON.parse(text)
  } catch { /* 继续 */ }
  // ```json ... ``` 代码块
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try {
      return JSON.parse(fenced[1])
    } catch { /* 继续 */ }
  }
  // 首个 { ... } 平衡块
  const start = text.indexOf('{')
  if (start >= 0) {
    let depth = 0
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1))
          } catch {
            break
          }
        }
      }
    }
  }
  return null
}

export const keywordAgentExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data
    const localTool = data.tool
    const format = data.format || '{\n  "keywords": string[]\n}'

    const logs: string[] = []
    logs.push(`关键词提取节点开始执行`)

    if (!localTool) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { keywords: [] },
        logs: [...logs, '未选择本地工具，跳过'],
      }
    }

    // 从上游输入中提取内容（P0-4：优先用「优先级排序 + 预算截断」后的累积上下文，
    // 覆盖整条祖先链路而非只取平铺字段；无累积时回退单字段提取）
    const budgeted = buildBudgetedContext(input, 64000)
    const upstreamContent =
      budgeted.response ||
      input.content ||
      input.text ||
      input.instruction ||
      input.retrievalContent ||
      input.result ||
      input.prompt ||
      input.query ||
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
    logs.push(`本地工具: ${localTool}`)
    logs.push(`正在调用本地工具提取关键词...`)

    try {
      // 加载系统提示词（支持「规则与模型」页面自定义）
      let basePrompt = `你是一个关键词提取助手。从给定内容中提取用于知识库检索的关键词。`
      try {
        const res = await fetch('/api/prompts?name=keywordAgent.md')
        const pdata = await res.json()
        if (pdata.status === 'success' && pdata.data?.content) {
          basePrompt = pdata.data.content
        }
      } catch { /* 使用默认提示词 */ }

      const prompt = [
        basePrompt,
        `输出格式要求（只输出 JSON，不要任何解释文字）：`,
        format,
        ``,
        `以下是待提取的内容：`,
        String(upstreamContent),
      ].join('\n\n')

      const taskId = await startAgentCli({ tool: localTool, prompt })
      const task = await pollAgentCliTask(taskId)
      if (task.status === 'error') {
        throw new Error(task.error || '本地工具执行失败')
      }

      const raw = task.output?.response || ''
      const parsed = parseLooseJson(raw)
      if (!parsed) {
        throw new Error('本地工具输出无法解析为 JSON')
      }
      const keywords: string[] = Array.isArray(parsed.keywords)
        ? parsed.keywords.map(String)
        : []
      const queries: string[] = Array.isArray(parsed.queries)
        ? parsed.queries.map(String)
        : []

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
          raw,
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
