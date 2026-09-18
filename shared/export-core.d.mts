/**
 * 共享导出核心类型声明（shared/export-core.mjs）
 *
 * 画布侧（src/services/exporter.ts）与 MCP 侧（runner/mcp.mjs）共用同一实现，
 * 本文件为 TS 侧提供类型化签名，保证两处导出行为与接口完全一致。
 */
import type { Node, Edge } from '@xyflow/react'
import type { SpecStepKey } from '../src/constants/spec'

export type ExportTarget = 'speckit' | 'openspec' | 'spec' | 'skill'

export interface ExportOptions {
  /** 工作流/变更名称 */
  name?: string
  /** 是否合并完全相同的并行步骤，默认 false（仅 speckit） */
  mergeParallel?: boolean
  /** SKILL 导出：frontmatter description（留空则按节点自动生成） */
  description?: string
}

export interface ExportResult {
  /** workflow.yml / schema.yaml / SKILL.md 文本 */
  yaml: string
  /** 主工作流文件在 zip / 项目内的相对路径 */
  workflowPath: string
}

export interface LarkRef {
  url: string
  kind: 'doc' | 'template'
  title: string
}

export interface CollectablePlan {
  userInputNodes: Node[]
  skills: string[]
  bmadNodes: Node[]
  memoryNodes: Node[]
  larkRefs: LarkRef[]
}

export declare const NodeTypes: {
  USER_INPUT: 'userInput'
  AGENT: 'agent'
  AI_OUTPUT: 'aiOutput'
  ANSWER: 'answer'
  BMAD_AGENT: 'bmadAgent'
  LARK: 'lark'
  IF: 'if'
  IF_CONDITION: 'ifCondition'
  LOOP: 'loop'
  LOOP_CONDITION: 'loopCondition'
  RETRY: 'retry'
  CODE_AGENT: 'codeAgent'
  SKILL: 'skill'
  LARK_TEMPLATE: 'larkTemplate'
  MEMORY: 'memory'
  KNOWLEDGE_RETRIEVAL: 'knowledgeRetrieval'
  KEYWORD_AGENT: 'keywordAgent'
  TASK_PLANNER: 'taskPlanner'
  SELF_CHECK: 'selfCheck'
  CUSTOM: 'custom'
}

export declare const SPEC_STEPS_KEYS: SpecStepKey[]

export declare function toStepId(raw: string, fallback: string): string
export declare function safeSegment(raw: string, fallback: string): string
export declare function isLocalSkillId(skillId: string): boolean
export declare function topologicalSort(
  nodes: Node[],
  edges: Edge[],
): { sortedIds: string[]; cycles: string[] }

export declare function userInputArtifactPath(node: Node): string
export declare function skillArtifactPath(skillId: string): string
export declare function bmadArtifactPath(node: Node): string
export declare function memoryArtifactPath(node: Node): string
export declare function openSpecSchemaDir(workflowName: string): string
export declare function specChangeDir(workflowName: string): string
export declare function skillDir(workflowName: string): string

export declare function buildSpecKitWorkflow(
  nodes: Node[],
  edges: Edge[],
  options?: ExportOptions,
): ExportResult
export declare function buildOpenSpecWorkflow(
  nodes: Node[],
  edges: Edge[],
  options?: ExportOptions,
): ExportResult
export declare function buildSpecWorkflow(
  nodes: Node[],
  edges: Edge[],
  options?: ExportOptions,
): ExportResult
export declare function buildSkillWorkflow(
  nodes: Node[],
  edges: Edge[],
  options?: ExportOptions,
): ExportResult
export declare function buildWorkflow(
  target: ExportTarget,
  nodes: Node[],
  edges: Edge[],
  options?: ExportOptions,
): ExportResult

export declare function autoSkillDescription(name: string, nodes: Node[]): string
export declare function listCollectableArtifacts(nodes: Node[]): CollectablePlan
