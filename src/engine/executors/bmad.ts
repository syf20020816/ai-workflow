import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * BMad 角色节点执行器
 * 后续对接 npx bmad-method CLI。
 */
export const bmadExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data

    const logs: string[] = []
    logs.push(`BMad 角色: ${data.role || data.title}`)
    if (data.model) logs.push(`模型: ${data.model}`)
    if (data.temperature !== undefined) logs.push(`温度: ${data.temperature}`)

    const inputText =
      (input as any).text || (input as any).response || JSON.stringify(input)

    // Phase 1: 模拟 BMad 处理
    const result = `[BMad模拟] 角色 "${data.role || data.title}" 分析结果\n${inputText.slice(0, 200)}`

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        analysis: result,
        role: data.role,
        model: data.model,
      },
      logs,
    }
  },
}
