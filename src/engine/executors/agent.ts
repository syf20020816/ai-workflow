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
          systemPrompt: config.data.systemPrompt || '',
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

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response: result.output.response,
          model: modal.name,
          usage: result.output.usage,
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
