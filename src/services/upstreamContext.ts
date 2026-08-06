/**
 * 上游上下文 · 优先级排序 + 预算截断
 *
 * P0-4 token 效率专项：codeAgent / keywordAgent / knowledgeRetrieval 三个 executor
 * 原先只透传 ctx.input（累积上下文未经裁剪）→ token 浪费 + 窗口挤掉关键内容。
 *
 * 这里提供与 agent.ts 一致的「优先级排序 + 预算截断」逻辑（纯函数，前后端共用）：
 * - 需求分析/指令（response/instructions）优先级最高（10/20），最不可能被截断
 * - 关键词（30）、模板（40）、通用内容（50）次之
 * - 检索结果（60）优先级最低，预算不足时最先被截断
 * - 块超出剩余预算时保留开头（不整块丢弃，否则超大块会导致全部内容被丢掉）
 */

export interface ContentBlock {
  priority: number
  text: string
}

/** 收集上游内容块（带优先级），并按预算截断返回 */
export function buildUpstreamBlocks(
  input: Record<string, any>,
  tokenMax?: number,
): ContentBlock[] {
  const contentBlocks: ContentBlock[] = []
  const upstreams: any[] = (input as any).upstreams || []

  if (upstreams.length > 0) {
    for (const up of upstreams) {
      if (up.retrievalContent) {
        contentBlocks.push({
          priority: 60,
          text: `【知识库检索结果】\n${up.retrievalContent}`,
        })
      } else if (up.response) {
        contentBlocks.push({
          priority: 10,
          text: `【上游智能体输出（${up.title || up.nodeType}）】\n${up.response}`,
        })
      } else if (Array.isArray(up.keywords) && up.keywords.length > 0) {
        contentBlocks.push({
          priority: 30,
          text: `【关键词（${up.title || up.nodeType}）】\n${up.keywords.join('、')}`,
        })
      } else if (up.templateContent) {
        contentBlocks.push({
          priority: 40,
          text: `【输出格式模板】\n${up.templateContent}`,
        })
      } else if (up.instructions) {
        contentBlocks.push({ priority: 20, text: up.instructions })
      } else if (up.content) {
        contentBlocks.push({
          priority: 50,
          text: `【上游内容（${up.title || up.nodeType}）】\n${up.content}`,
        })
      } else if (up.result) {
        contentBlocks.push({
          priority: 50,
          text: `【上游内容（${up.title || up.nodeType}）】\n${up.result}`,
        })
      } else if (typeof up.text === 'string' && up.text) {
        contentBlocks.push({ priority: 10, text: up.text })
      }
    }
  } else {
    // 兼容无累积上下文的情况（单节点执行等）：沿用平铺输入启发式
    const skipKeys = new Set([
      'text', 'prompt', 'query', 'queries', 'results', 'count',
      'model', 'usage', 'role', 'modal', 'error', 'status', 'output', 'logs',
      'bmadMethod', 'bmadInstalled', 'nodeType', 'nodeId', 'title',
      'collectionNames', 'retrievalContent', 'response', 'templateContent', 'instructions',
    ])
    if ((input as any).instructions) {
      contentBlocks.push({ priority: 20, text: (input as any).instructions })
    }
    if ((input as any).templateContent) {
      contentBlocks.push({
        priority: 40,
        text: `【输出格式模板】\n${(input as any).templateContent}`,
      })
    }
    if ((input as any).retrievalContent) {
      contentBlocks.push({
        priority: 60,
        text: `【知识库检索结果】\n${(input as any).retrievalContent}`,
      })
    }
    if (typeof (input as any).response === 'string' && (input as any).response) {
      contentBlocks.push({
        priority: 10,
        text: `【上游智能体输出】\n${(input as any).response}`,
      })
    }
    for (const [key, val] of Object.entries(input)) {
      if (typeof val === 'string' && val.length > 50 && !skipKeys.has(key)) {
        if (
          !contentBlocks.some(
            (b) =>
              val.startsWith(b.text.slice(0, 60)) ||
              b.text.startsWith(val.slice(0, 60)),
          )
        ) {
          contentBlocks.push({ priority: 50, text: val })
        }
      }
    }
  }

  // 按优先级排序：高价值内容在前，检索结果最后（预算不足先截检索尾部）
  contentBlocks.sort((a, b) => a.priority - b.priority)

  // 预算截断：1 token ≈ 2 字符估算，预留约 40% 空间给模型输出
  const maxTokens = tokenMax || 64000
  const MAX_CONTENT_LENGTH = Math.min(Math.floor(maxTokens * 1.2), 150000)
  let remaining = MAX_CONTENT_LENGTH
  const result: ContentBlock[] = []
  for (const block of contentBlocks) {
    if (remaining <= 0) break
    if (block.text.length <= remaining) {
      result.push(block)
      remaining -= block.text.length
    } else {
      result.push({ priority: block.priority, text: block.text.slice(0, remaining) })
      remaining = 0
    }
  }
  return result
}

/** 把内容块拼接为文本 */
export function blocksToText(
  blocks: ContentBlock[],
  separator = '\n\n---\n\n',
): string {
  return blocks.map((b) => b.text).join(separator)
}

/**
 * 构建裁剪后的上游上下文（codeAgent 用）：
 * - response：除模板外的全部内容块拼接（供「需求分析/编码上下文」）
 * - templateContent：模板块（供「输出格式」约束）
 */
export function buildBudgetedContext(
  input: Record<string, any>,
  tokenMax?: number,
): { response: string; templateContent?: string } {
  const blocks = buildUpstreamBlocks(input, tokenMax)
  const templateBlock = blocks.find((b) => b.text.startsWith('【输出格式模板】'))
  const others = blocks.filter((b) => b !== templateBlock)
  return {
    response: blocksToText(others),
    ...(templateBlock ? { templateContent: templateBlock.text } : {}),
  }
}
