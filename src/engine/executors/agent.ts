import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * 智能体节点执行器
 * 调用真实的 AI API（OpenAI/Anthropic/Ollama 兼容格式）
 */
export const agentExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const modal = config.data.modal || {}

    if (!modal.name) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: ['未配置模型，请在编辑面板中选择模型'],
        error: '未选择模型',
      }
    }

    if (!modal.url) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: ['API URL 未配置'],
        error: 'API URL 未配置',
      }
    }

    const inputText =
      (input as any).text || (input as any).prompt || JSON.stringify(input)

    // 收集上游所有内容块（Skill节点指令、Lark模板等，可能有多个同类型节点）
    const contentBlocks: string[] = []

    // 1. Skill 节点指令
    if ((input as any).instructions) {
      contentBlocks.push((input as any).instructions)
    }

    // 2. Lark 模板内容
    if ((input as any).templateContent) {
      contentBlocks.push(`【输出格式模板】\n${(input as any).templateContent}`)
    }

    // 3. 扫描所有输入值，收集可能的内容块（处理多个同名节点覆盖问题）
    const skipKeys = new Set([
      'text', 'prompt', 'response', 'analysis', 'result',
      'model', 'usage', 'role', 'modal',
      'bmadMethod', 'bmadInstalled',
      'error', 'status', 'output', 'logs',
      'skillName', 'skillId', 'templateUrl',
      'url', 'action', 'success',
      'fromCodeNode', 'codeStatus', 'codeMode',
      'codeFile', 'codeBranch', 'codeError',
    ])
    for (const [key, val] of Object.entries(input)) {
      if (typeof val === 'string' && val.length > 50 && !skipKeys.has(key)) {
        // 避免重复添加
        if (!contentBlocks.some((b) => val.startsWith(b.slice(0, 60)) || b.startsWith(val.slice(0, 60)))) {
          contentBlocks.push(val)
        }
      }
    }

    // 限制内容块总长度，防止超出模型上下文窗口
    const MAX_CONTENT_LENGTH = 6000
    let totalContentLength = 0
    const truncatedBlocks = contentBlocks.filter((b) => {
      totalContentLength += b.length
      if (totalContentLength > MAX_CONTENT_LENGTH) return false
      return true
    })
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
    logs.push(`调用模型: ${modal.name}`)

    try {
      const res = await fetch('/api/execute/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: {
            url: modal.url,
            apiKey: modal.key,
            modelName: modal.name,
            token: modal.token,
          },
          messages: [
            {
              role: 'user',
              content: inputText,
            },
          ],
          systemPrompt,
          temperature: config.data.temperature ?? 0.3,
        }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: {},
          logs: [...logs, ...(result.logs || []), result.error],
          error: result.error,
        }
      }

      logs.push(...(result.logs || []))
      logs.push(`智能体 "${modal.alias || config.title}" 执行完成`)

      // 将上游的内容块透传到下游，供后续节点（如 BMad）使用
      const passThrough: Record<string, string> = {}
      if ((input as any).templateContent) passThrough.templateContent = (input as any).templateContent
      if ((input as any).instructions) passThrough.instructions = (input as any).instructions

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response: result.output.response,
          model: modal.name,
          usage: result.output.usage,
          ...passThrough,
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, `请求失败: ${err.message}`],
        error: `AI API 调用失败: ${err.message}`,
      }
    }
  },
}
