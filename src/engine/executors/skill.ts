import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { loadSkillInstruction, isLocalSkillId } from '#/services/skill'

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
      // 支持平台技能与本机工具技能（local:<tool>:<skill>，由 Runner 读取用户本机 SKILL.md）
      const content = await loadSkillInstruction(skillId)

      if (!content) {
        logs.push(
          isLocalSkillId(skillId)
            ? `本机技能 ${data.skillName || skillId} 内容为空（Runner 未启动或技能不存在）`
            : `技能 ${data.skillName || skillId} 内容为空`,
        )
      } else {
        logs.push(`技能内容已加载 (${content.length} 字符)`)
      }

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          instructions: content,
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
