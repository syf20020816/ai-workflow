import type { Node, Edge } from '@xyflow/react'
import type { BmadSkill } from './parser'
import { BMAD_PHASES, getPhaseInfo } from './parser'

/**
 * 映射上下文：工作流节点编排信息
 */
export interface WorkflowMappingContext {
  /** 所有节点 */
  nodes: Node[]
  /** 所有连线 */
  edges: Edge[]
  /** 用户输入的意图/描述 */
  intent: string
  /** 可选：指定 BMad 项目根目录 */
  bmadRoot?: string
}

/**
 * 映射结果：BMad Method 工作流指令
 */
export interface WorkflowMappingResult {
  /** 映射到的 BMad 阶段 */
  phase: string
  phaseLabel: string
  /** 推荐的 BMad Skills */
  recommendedSkills: BmadSkill[]
  /** 生成的 BMad Method 指令 */
  instructions: string
  /** 工作流描述 */
  description: string
  /** 执行计划 */
  executionPlan: string[]
}

/**
 * 节点类型到 BMad 阶段的映射
 */
const NODE_TYPE_TO_PHASE: Record<string, string> = {
  userInput: '1-analysis',
  agent: '4-implementation',
  bmadAgent: '3-solutioning',
  lark: 'anytime',
  answer: '2-planning',
  aiOutput: 'anytime',
}

/**
 * 分析工作流节点编排，确定整体 BMad 阶段
 */
export function analyzeWorkflowPhase(nodes: Node[], edges: Edge[]): {
  phase: string
  phaseLabel: string
  confidence: number
} {
  if (nodes.length === 0) {
    return { phase: 'anytime', phaseLabel: '随时可用', confidence: 0 }
  }

  // 统计各类型节点占比
  const typeCount: Record<string, number> = {}
  for (const node of nodes) {
    const t = node.type || 'unknown'
    typeCount[t] = (typeCount[t] || 0) + 1
  }

  // 确定主要阶段
  let dominantPhase = 'anytime'
  let maxCount = 0

  for (const [nodeType, count] of Object.entries(typeCount)) {
    const phase = NODE_TYPE_TO_PHASE[nodeType] || 'anytime'
    // 如果该类型节点数超过半数，或比例最高
    if (count > maxCount) {
      maxCount = count
      dominantPhase = phase
    }
  }

  // 检查起点节点类型（第一个节点决定阶段倾向）
  const entryEdges = edges.filter((e) => !edges.some((ee) => ee.target === e.source))
  const entryNodeIds = new Set(entryEdges.map((e) => e.source))
  if (entryNodeIds.size === 0 && nodes.length > 0) {
    // 孤立节点，取第一个
    entryNodeIds.add(nodes[0].id)
  }

  // 如果有 userInput 作为起点，属于 analysis 阶段
  for (const nodeId of entryNodeIds) {
    const node = nodes.find((n) => n.id === nodeId)
    if (node?.type === 'userInput') {
      dominantPhase = '1-analysis'
    }
  }

  // 检查是否有 agent + bmadAgent 组合（solutioning 阶段特征）
  if (typeCount['agent'] && typeCount['bmadAgent']) {
    dominantPhase = '3-solutioning'
  }

  // 纯 agent 节点链属于 implementation
  if (typeCount['agent'] && !typeCount['userInput'] && !typeCount['bmadAgent']) {
    dominantPhase = '4-implementation'
  }

  const info = getPhaseInfo(dominantPhase)
  return {
    phase: dominantPhase,
    phaseLabel: info.label,
    confidence: maxCount / nodes.length,
  }
}

/**
 * 从可用技能列表中推荐与当前阶段匹配的技能
 */
export function recommendSkills(
  skills: BmadSkill[],
  phase: string,
  intent: string,
  count: number = 3,
): BmadSkill[] {
  // 过滤匹配阶段的技能
  const phaseSkills = skills.filter(
    (s) => s.phase === phase || s.phase === 'anytime',
  )

  // 根据意图关键词排序
  const intentKeywords = intent.toLowerCase().split(/\s+/)

  const scored = phaseSkills.map((skill) => {
    let score = 0
    const desc = skill.description.toLowerCase()
    const name = skill.displayName.toLowerCase()

    for (const kw of intentKeywords) {
      if (desc.includes(kw)) score += 2
      if (name.includes(kw)) score += 3
      if (skill.skill.includes(kw)) score += 1
    }

    // required 技能优先
    if (skill.required === 'true') score += 5

    return { skill, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, count).map((s) => s.skill)
}

/**
 * 生成 BMad Method 工作流指令
 *
 * 根据画布上的节点编排，生成遵循 BMad Method 方法论的结构化指令，
 * 供 AI 模型执行时使用。
 */
export function generateBmadInstructions(
  phase: string,
  phaseLabel: string,
  recommendedSkills: BmadSkill[],
  nodes: Node[],
  edges: Edge[],
  intent: string,
): string {
  const nodeSummary = nodes
    .map((n) => `- ${(n.data as any)?.title || n.type} (${n.type})`)
    .join('\n')

  const edgeSummary = edges
    .map((e) => `  ${e.source} → ${e.target}`)
    .join('\n')

  const skillsSection = recommendedSkills
    .map(
      (s, i) =>
        `${i + 1}. **${s.displayName}** (\`${s.skill}\`) - ${s.description}`,
    )
    .join('\n')

  return `# BMad Method 工作流指令

## 阶段: ${phaseLabel} (${phase})

## 用户意图
${intent || '未指定'}

## 工作流节点编排
${nodeSummary || '无节点'}

## 节点连线关系
${edgeSummary || '无连线'}

## 推荐 BMad Skills
${skillsSection || '无可推荐技能'}

## 执行说明
请遵循 BMad Method 方法论，按以下步骤执行：

1. 理解用户意图和工作流节点编排
2. 选择最匹配的 BMad Skill 进行执行
3. 将上游节点的输出作为输入上下文
4. 执行完成后将结果传递给下游节点
5. 保持 BMad 的输出规范（结构化 Markdown）

## 角色配置
${recommendedSkills
  .filter((s) => s.module === 'bmm' && s.skill.startsWith('bmad-agent-'))
  .map(
    (s) =>
      `- ${s.displayName}: ${s.description}`,
  )
  .join('\n') || '无特定角色'}
`
}

/**
 * 生成执行计划
 */
export function generateExecutionPlan(
  skills: BmadSkill[],
  nodes: Node[],
  edges: Edge[],
): string[] {
  const plan: string[] = []

  // 确定起点
  const entryNodes = nodes.filter(
    (n) => !edges.some((e) => e.target === n.id),
  )

  for (const entry of entryNodes) {
    plan.push(`📥 输入: ${(entry.data as any)?.title || entry.type}`)
  }

  // 按阶段排序技能
  const phaseOrder = BMAD_PHASES.map((p) => p.id)
  const sortedSkills = [...skills].sort((a, b) => {
    return phaseOrder.indexOf(a.phase as any) - phaseOrder.indexOf(b.phase as any)
  })

  for (const skill of sortedSkills) {
    const phaseInfo = getPhaseInfo(skill.phase)
    plan.push(`🔧 [${phaseInfo.label}] ${skill.displayName}: ${skill.description}`)
  }

  // 确定终点
  const exitNodes = nodes.filter(
    (n) => !edges.some((e) => e.source === n.id),
  )
  for (const exit of exitNodes) {
    plan.push(`📤 输出: ${(exit.data as any)?.title || exit.type}`)
  }

  return plan
}

/**
 * 主映射函数：将工作流节点编排映射到 BMad Method
 */
export function mapWorkflowToBmad(
  context: WorkflowMappingContext,
  availableSkills: BmadSkill[],
): WorkflowMappingResult {
  const { nodes, edges, intent } = context

  // 1. 分析阶段
  const { phase, phaseLabel } = analyzeWorkflowPhase(nodes, edges)

  // 2. 推荐技能
  const recommendedSkills = recommendSkills(availableSkills, phase, intent)

  // 3. 生成指令
  const instructions = generateBmadInstructions(
    phase,
    phaseLabel,
    recommendedSkills,
    nodes,
    edges,
    intent,
  )

  // 4. 生成执行计划
  const executionPlan = generateExecutionPlan(recommendedSkills, nodes, edges)

  // 5. 描述
  const nodeTypes = [...new Set(nodes.map((n) => n.type))]
  const description = `工作流包含 ${nodeTypes.length} 种节点类型 (${nodeTypes.join(', ')}), 映射到 BMad ${phaseLabel} 阶段`

  return {
    phase,
    phaseLabel,
    recommendedSkills,
    instructions,
    description,
    executionPlan,
  }
}
