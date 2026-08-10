/**
 * BMad Agent 定义（来自 config.toml）
 */
export interface BmadAgent {
  id: string
  module: string
  team: string
  name: string
  title: string
  icon: string
  description: string
}

/**
 * BMad Skill 定义（来自 CSV 文件）
 */
export interface BmadSkill {
  module: string
  skill: string
  displayName: string
  menuCode: string
  description: string
  action: string
  args: string
  phase: string
  precededBy: string
  followedBy: string
  required: string
  outputLocation: string
  outputs: string
  /** 解析后的前置技能列表 */
  precededSkills: string[]
  /** 解析后的后继技能列表 */
  followedSkills: string[]
}

/**
 * BMad 工作流阶段定义
 */
export const BMAD_PHASES = [
  { id: '0-learning', label: '学习', order: 0 },
  { id: '1-analysis', label: '需求分析', order: 1 },
  { id: '2-planning', label: '规划', order: 2 },
  { id: '3-solutioning', label: '方案设计', order: 3 },
  { id: '4-implementation', label: '实现', order: 4 },
  { id: 'anytime', label: '随时可用', order: 99 },
] as const

export type BmadPhaseId = (typeof BMAD_PHASES)[number]['id']

/**
 * 解析 BMad config.toml 中的 agents 段
 */
export function parseBmadAgents(tomlContent: string): BmadAgent[] {
  const agents: BmadAgent[] = []

  // 过滤注释行（避免注释中的 [agents.xxx] 示例被误解析）
  const cleanContent = tomlContent
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n')

  const sectionRegex = /\[agents\.([^\]]+)\]\s*\n([\s\S]*?)(?=\n\[|\s*$)/g
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(cleanContent)) !== null) {
    const id = match[1]
    const body = match[2]

    const props: Record<string, string> = {}
    const propRegex = /(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/g
    let propMatch: RegExpExecArray | null
    while ((propMatch = propRegex.exec(body)) !== null) {
      props[propMatch[1]] = propMatch[2]
    }

    if (Object.keys(props).length > 0) {
      agents.push({
        id,
        module: props['module'] || '',
        team: props['team'] || '',
        name: props['name'] || '',
        title: props['title'] || '',
        icon: props['icon'] || '',
        description: props['description'] || '',
      })
    }
  }

  return agents
}

/**
 * 解析 BMad Skills CSV 内容
 * CSV 格式：逗号分隔，带引号字段，第一行为表头
 */
export function parseBmadSkillsCsv(csvContent: string): BmadSkill[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  // 解析 CSV 行（支持引号包围的字段，含逗号）
  function parseCsvLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const header = parseCsvLine(lines[0])
  const skills: BmadSkill[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const fields = parseCsvLine(line)
    if (fields.length < 2) continue

    // 构建对象：根据表头映射字段
    const skill: Record<string, string> = {}
    for (let j = 0; j < header.length && j < fields.length; j++) {
      skill[header[j]] = fields[j]
    }

    // 跳过 _meta 行
    if (skill['skill'] === '_meta') continue

    const precededBy = skill['preceded-by'] || ''
    const followedBy = skill['followed-by'] || ''

    skills.push({
      module: skill['module'] || '',
      skill: skill['skill'] || '',
      displayName: skill['display-name'] || '',
      menuCode: skill['menu-code'] || '',
      description: skill['description'] || '',
      action: skill['action'] || '',
      args: skill['args'] || '',
      phase: skill['phase'] || 'anytime',
      precededBy,
      followedBy,
      required: skill['required'] || 'false',
      outputLocation: skill['output-location'] || '',
      outputs: skill['outputs'] || '',
      precededSkills: precededBy ? precededBy.split(',').map((s: string) => s.trim()).filter((s) => s.length > 0) : [],
      followedSkills: followedBy ? followedBy.split(',').map((s: string) => s.trim()).filter((s) => s.length > 0) : [],
    })
  }

  return skills
}

/**
 * 按阶段分组技能
 */
export function groupSkillsByPhase(skills: BmadSkill[]): Record<string, BmadSkill[]> {
  const groups: Record<string, BmadSkill[]> = {}
  for (const skill of skills) {
    const phase = skill.phase || 'anytime'
    ;(groups[phase] ??= []).push(skill)
  }
  return groups
}

/**
 * 根据阶段 ID 获取阶段显示信息
 */
export function getPhaseInfo(phaseId: string): { label: string; order: number } {
  const phase = BMAD_PHASES.find((p) => p.id === phaseId)
  return phase || { label: '未知阶段', order: 99 }
}

/**
 * 从技能列表中构建工作流图谱（DAG 结构）
 */
export function buildSkillGraph(skills: BmadSkill[]): {
  nodes: { id: string; phase: string; label: string; required: boolean }[]
  edges: { from: string; to: string }[]
} {
  const nodes: { id: string; phase: string; label: string; required: boolean }[] = []
  const edges: { from: string; to: string }[] = []

  for (const skill of skills) {
    nodes.push({
      id: skill.skill,
      phase: skill.phase,
      label: skill.displayName,
      required: skill.required === 'true',
    })

    for (const pred of skill.precededSkills) {
      if (pred) {
        edges.push({ from: pred, to: skill.skill })
      }
    }
  }

  return { nodes, edges }
}
