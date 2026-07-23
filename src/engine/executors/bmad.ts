import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * BMad 角色节点执行器
 *
 * BMad 节点是 Skill 节点的一种特殊形式 —— 它将 BMad 角色的描述/职责
 * 作为 instructions（系统指令）传递给下游的智能体节点。
 *
 * 执行流程：
 * 1. 读取角色定义（roleDescription / systemPrompt）
 * 2. 构建 instructions 指令文本
 * 3. 直接传递给下游，不做独立的 AI 调用
 *
 * 注意：BMad 节点不自带模型配置，由下游 Agent 节点统一处理 AI 调用。
 */
export const bmadExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const data = config.data

    const logs: string[] = []

    // 构建角色指令（优先 systemPrompt，回退到 roleDescription）
    const effectivePrompt = data.systemPrompt || data.roleDescription || ''
    const roleName = data.role || config.title || ''

    if (!effectivePrompt) {
      logs.push(`BMad 角色 "${roleName}" 无指令内容，跳过`)
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { instructions: '', role: roleName },
        logs,
      }
    }

    logs.push(`BMad 角色: ${roleName}`)
    logs.push(`角色指令已加载 (${effectivePrompt.length} 字符)`)

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        instructions: effectivePrompt,
        role: roleName,
      },
      logs,
    }
  },
}
