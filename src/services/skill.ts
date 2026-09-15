import { fetchLocalToolSkillContent } from '#/services/runner'

/** 判断是否为本机工具技能（skillId 形如 local:<tool>:<skillName>） */
export function isLocalSkillId(skillId: string): boolean {
  return skillId.startsWith('local:')
}

/**
 * 加载技能指令内容，支持两种来源：
 *  - 平台技能：skillId 为技能 ID，从 workflows/skills/{id}/SKILL.md 读取
 *  - 本机工具技能：skillId 形如 local:<tool>:<skillName>，由 Runner 读取用户本机 SKILL.md
 * 返回空串表示无内容 / 加载失败（调用方按空内容处理）
 */
export async function loadSkillInstruction(skillId: string): Promise<string> {
  if (!skillId) return ''

  if (isLocalSkillId(skillId)) {
    const rest = skillId.slice('local:'.length)
    const sep = rest.indexOf(':')
    if (sep === -1) return ''
    return fetchLocalToolSkillContent(rest.slice(0, sep), rest.slice(sep + 1))
  }

  try {
    const res = await fetch(`/api/skill/content?id=${skillId}`)
    const result = await res.json()
    return result.content || ''
  } catch {
    return ''
  }
}
