import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * BMad 角色节点执行器
 *
 * 接收上游 Agent 的输出，利用 BMad 角色定义(roleDescription/systemPrompt)，
 * 对 Agent 的响应进行角色视角的分析和补充。
 *
 * 如果配置了 systemPrompt，会调用 AI API 对该角色视角进行分析；
 * 否则直接返回角色注解。
 */
export const bmadExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data

    const logs: string[] = []
    logs.push(`BMad 角色: ${data.role || config.title}`)

    const upstreamResponse =
      (input as any).response || (input as any).analysis || ''

    // 如果有 systemPrompt，调用 AI 进行角色分析
    if (data.systemPrompt && upstreamResponse) {
      logs.push('使用角色提示词进行分析...')

      try {
        // 尝试从上游 AgentNode 获取模型配置（通过全局上下文）
        const modalConfig = (ctx.globalContext as any).modelConfig

        if (modalConfig?.url) {
          const res = await fetch('/api/execute/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modalConfig,
              messages: [
                {
                  role: 'user',
                  content: `请从以下角色视角分析上游的输出:\n\n${upstreamResponse}`,
                },
              ],
              systemPrompt: data.systemPrompt,
              temperature: data.temperature ?? 0.3,
            }),
          })

          const result = await res.json()
          if (result.status === 'success') {
            logs.push('角色分析完成')
            return {
              nodeId: config.nodeId,
              status: 'success',
              output: {
                analysis: result.output.response,
                role: data.role,
                model: data.model,
              },
              logs,
            }
          }
        }
      } catch {
        logs.push('AI 分析失败，回退到纯文本注解')
      }
    }

    // 纯文本注解（无 AI 调用或调用失败时的回退）
    const analysis = upstreamResponse
      ? `[${data.role || config.title} 视角]\n${upstreamResponse.slice(0, 500)}`
      : `[${data.role || config.title}] 待上游数据`

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        analysis,
        role: data.role,
        model: data.model,
        systemPrompt: data.systemPrompt,
      },
      logs,
    }
  },
}
