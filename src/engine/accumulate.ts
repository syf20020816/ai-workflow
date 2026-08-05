import { NodeTypes } from '#/types'

/**
 * 上下文累积提取器
 *
 * 引擎在执行每个节点时，会把所有上游祖先节点的输出按拓扑顺序累积进 input.upstreams。
 * 但上游节点的完整输出包含大量中间结果（model/usage/results/count/…），全部保留会撑爆模型上下文。
 * 因此按节点类型只提取下游真正需要的内容字段，其余一律丢弃。
 *
 * 提取规则（与用户约定）：
 * - agent / codeAgent      → 只保留 response（需求分析/技术方案正文）
 * - keywordAgent           → 只保留 keywords
 * - knowledgeRetrieval     → 只保留 retrievalContent（最完整，results 是中间结果）
 * - 其余类型               → 保留各自的内容类字段（text/content/result/templateContent/instructions 等）
 */
export function extractAccumulated(
  nodeType: string,
  output: Record<string, any>,
): Record<string, any> {
  const acc: Record<string, any> = {}

  switch (nodeType) {
    case NodeTypes.AGENT:
    case NodeTypes.CODE_AGENT:
      if (typeof output.response === 'string') acc.response = output.response
      break

    case NodeTypes.KEYWORD_AGENT:
      if (Array.isArray(output.keywords) && output.keywords.length > 0) {
        acc.keywords = output.keywords
      }
      break

    case NodeTypes.TASK_PLANNER:
      if (typeof output.response === 'string') acc.response = output.response
      else if (typeof output.tasksMarkdown === 'string') {
        acc.response = output.tasksMarkdown
      }
      break

    case NodeTypes.KNOWLEDGE_RETRIEVAL:
      if (typeof output.retrievalContent === 'string') {
        acc.retrievalContent = output.retrievalContent
      }
      break

    case NodeTypes.USER_INPUT:
      if (typeof output.text === 'string') acc.text = output.text
      else if (typeof output.prompt === 'string') acc.text = output.prompt
      break

    case NodeTypes.LARK_TEMPLATE:
      if (typeof output.templateContent === 'string') {
        acc.templateContent = output.templateContent
      }
      break

    case NodeTypes.LARK:
    case NodeTypes.LARK_WIKI_TRAVERSAL:
      if (typeof output.result === 'string') acc.result = output.result
      break

    case NodeTypes.MEMORY:
      if (typeof output.content === 'string') acc.content = output.content
      break

    case NodeTypes.BMAD_AGENT:
      if (typeof output.instructions === 'string') {
        acc.instructions = output.instructions
      }
      break

    default:
      // 通用回退：仅保留内容类字段，丢弃执行元数据（model/usage/status/…）
      if (typeof output.response === 'string') acc.response = output.response
      if (typeof output.text === 'string') acc.text = output.text
      if (typeof output.content === 'string') acc.content = output.content
      if (typeof output.result === 'string') acc.result = output.result
      if (typeof output.templateContent === 'string') {
        acc.templateContent = output.templateContent
      }
      if (typeof output.instructions === 'string') {
        acc.instructions = output.instructions
      }
      if (Array.isArray(output.keywords) && output.keywords.length > 0) {
        acc.keywords = output.keywords
      }
      if (typeof output.retrievalContent === 'string') {
        acc.retrievalContent = output.retrievalContent
      }
  }

  return acc
}
