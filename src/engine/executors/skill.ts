import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const skillExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config } = ctx
    const data = config.data
    const skillId = data.skillId || ''

    const logs: string[] = []
    logs.push(`加载技能: ${data.skillName || skillId}`)

    if (!skillId) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: { instructions: '', skillName: '' },
        logs: [...logs, '未选择技能，跳过'],
      }
    }

    try {
      const res = await fetch(`/api/skill/content?id=${skillId}`)
      const result = await res.json()

      if (!result.content) {
        logs.push(`技能 ${data.skillName || skillId} 内容为空`)
      } else {
        logs.push(`技能内容已加载 (${result.content.length} 字符)`)
      }

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          instructions: result.content || '',
          skillName: data.skillName || '',
          skillId,
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: { instructions: '', skillName: data.skillName || '' },
        logs: [...logs, `加载技能失败: ${err.message}`],
        error: `加载技能失败: ${err.message}`,
      }
    }
  },
}
