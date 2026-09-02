import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { startAgentCli, pollAgentCliTask } from '#/services/runner'

/**
 * 智能体节点执行器
 * 由用户本机的 AI CLI 工具（Claude Code / Codex / DeepSeek 等）无头模式执行，
 * 平台不持有任何模型凭据。
 */
export const agentExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const localTool = config.data.tool

    if (!localTool) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: ['未选择本地工具，请在编辑面板中选择'],
        error: '未选择本地工具',
      }
    }

    // 上下文累积：引擎已把所有上游祖先节点的规范摘要放进 input.upstreams
    const upstreams: any[] = (input as any).upstreams || []

    const inputText =
      (input as any).text ||
      (input as any).prompt ||
      upstreams.find((u: any) => u.text)?.text ||
      // 兜底：排除 upstreams，避免用户消息与 systemPrompt 内容块重复（浪费 token）
      JSON.stringify({ ...input, upstreams: undefined })

    // 收集上游所有内容块（带优先级：需求分析/指令优先，检索结果最后，预算不足时先截检索尾部）
    interface ContentBlock {
      priority: number
      text: string
    }
    const contentBlocks: ContentBlock[] = []

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
        }
        // 上游 userInput 的 text 已作为用户消息，不重复加入内容块
      }
    } else {
      // 兼容无累积上下文的情况（单节点执行等），沿用原有的平铺输入启发式
      // 1. Skill 节点指令
      if ((input as any).instructions) {
        contentBlocks.push({ priority: 20, text: (input as any).instructions })
      }
      // 2. Lark 模板内容
      if ((input as any).templateContent) {
        contentBlocks.push({
          priority: 40,
          text: `【输出格式模板】\n${(input as any).templateContent}`,
        })
      }
      // 3. 知识库检索结果
      if ((input as any).retrievalContent) {
        contentBlocks.push({
          priority: 60,
          text: `【知识库检索结果】\n${(input as any).retrievalContent}`,
        })
      }
      // 4. 上游智能体节点的输出（如"需求分析"）
      if ((input as any).response && typeof (input as any).response === 'string') {
        contentBlocks.push({
          priority: 10,
          text: `【上游智能体输出】\n${(input as any).response}`,
        })
      }
      // 5. 扫描所有输入值，收集可能的内容块（跳过执行元数据字段）
      const skipKeys = new Set([
        'text', 'prompt', 'response', 'analysis', 'result',
        'model', 'usage', 'role', 'modal',
        'bmadMethod', 'bmadInstalled',
        'error', 'status', 'output', 'logs',
        'skillName', 'skillId', 'templateUrl',
        'url', 'action', 'success',
        'fromCodeNode', 'codeStatus', 'codeMode',
        'codeFile', 'codeBranch', 'codeError',
        'retrievalContent', // 已在上面单独处理
      ])
      for (const [key, val] of Object.entries(input)) {
        if (typeof val === 'string' && val.length > 50 && !skipKeys.has(key)) {
          // 避免重复添加
          if (!contentBlocks.some((b) => val.startsWith(b.text.slice(0, 60)) || b.text.startsWith(val.slice(0, 60)))) {
            contentBlocks.push({ priority: 50, text: val })
          }
        }
      }
    }

    // 按优先级排序：高价值内容（需求分析/指令/关键词）在前，检索结果最后，预算不足时先截检索尾部
    contentBlocks.sort((a, b) => a.priority - b.priority)

    // 限制内容块总长度，防止超出本地工具的上下文窗口
    // 注意：超出预算时按块保留开头并截断，而不是整块丢弃（否则超大块会导致所有内容全被丢掉）
    // 旧模型配置的 token 上限已随模型配置下线，按通用上限估算
    const tokenMax = 64000
    // 1 token ≈ 2 字符估算，预留约 40% 的空间给模型输出
    const MAX_CONTENT_LENGTH = Math.min(Math.floor(tokenMax * 1.2), 150000)
    let remainingBudget = MAX_CONTENT_LENGTH
    const truncatedBlocks: string[] = []
    for (const block of contentBlocks) {
      if (remainingBudget <= 0) break
      if (block.text.length <= remainingBudget) {
        truncatedBlocks.push(block.text)
        remainingBudget -= block.text.length
      } else {
        // 块超出剩余预算：保留开头部分（检索结果按相关度排序，开头最相关）
        truncatedBlocks.push(block.text.slice(0, remainingBudget))
        remainingBudget = 0
      }
    }
    if (truncatedBlocks.length < contentBlocks.length) {
      console.log(`内容块过长已截断 (共 ${contentBlocks.length} 块，保留 ${truncatedBlocks.length} 块)`)
    }

    // 构建 system prompt：节点自定义 prompt + 上游内容块
    let systemPrompt = config.data.systemPrompt || ''

    // 分离模板内容和其他内容块，模板需要更强的格式约束
    const templateBlock = truncatedBlocks.find((b) => b.startsWith('【输出格式模板】'))
    const otherBlocks = truncatedBlocks.filter((b) => !b.startsWith('【输出格式模板】'))

    if (otherBlocks.length > 0) {
      const intro = otherBlocks.length === 1
        ? '\n\n以下是来自上游节点的参考内容：\n\n'
        : '\n\n以下是来自上游节点的多个参考内容：\n\n'
      systemPrompt = `${systemPrompt}${intro}${otherBlocks.join('\n\n---\n\n')}`
    }

    if (templateBlock) {
      // 模板需要强约束：必须输出模板结构
      systemPrompt = `${systemPrompt}\n\n【格式约束】请严格使用以下模板输出内容。你必须输出完整的模板结构（包括表格、标题），仅将模板中的空白占位符替换为实际信息，不要删除或改变模板的框架结构。如果模板中有空表格行，你可以按需填充内容行，但必须保留原表格列结构。\n\n${templateBlock}`
    }

    const logs: string[] = []

    // === 本地 CLI 工具执行（平台不持有任何模型凭据）===
    logs.push(`使用本地工具: ${localTool}`)

    try {
      // CLI 无 system/message 之分，合并为单个 prompt
      const prompt = systemPrompt
        ? `${systemPrompt}\n\n---\n\n${inputText}`
        : inputText

      const taskId = await startAgentCli({ tool: localTool, prompt })
      logs.push(`任务已提交: ${taskId}`)

      // 轮询直到完成，运行中的日志（stderr 采样）持续追加
      const seenLogCount = { n: 0 }
      const task = await pollAgentCliTask(taskId, (t) => {
        const fresh = t.logs.slice(seenLogCount.n)
        if (fresh.length > 0) {
          logs.push(...fresh)
          seenLogCount.n = t.logs.length
        }
      })

      if (task.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: {},
          logs: [...logs, task.error || '本地工具执行失败'],
          error: task.error || '本地工具执行失败',
        }
      }

      // 将上游的内容块透传到下游，供后续节点（如 BMad）使用
      const passThrough: Record<string, string> = {}
      if ((input as any).templateContent) passThrough.templateContent = (input as any).templateContent
      if ((input as any).instructions) passThrough.instructions = (input as any).instructions

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response: task.output?.response || '',
          model: task.toolName || localTool,
          ...passThrough,
        },
        logs: [...logs, `本地工具 "${task.toolName}" 执行完成`],
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, `请求失败: ${err.message}`],
        error: `本地工具执行失败: ${err.message}`,
      }
    }
  },
}
