/**
 * 工作流导出服务
 *
 * 把平台画布节点/连线翻译为外部可执行格式：
 * - Speckit：workflow.yml（命令步骤流水线）
 * - OpenSpec：schema.yaml 语义的内容，按约定放在 openspec/changes/<name>/workflow.yml
 *
 * 本文件只包含纯函数，不涉及 fs/path 等 Node 内置模块，可在前端或后端使用。
 */
import { dump } from 'js-yaml'
import type { Node, Edge } from '@xyflow/react'
import { NodeTypes } from '#/types'
import type { SpecStepKey } from '#/constants/spec'
import { topologicalSort } from '#/engine/topological'
import { stripModal } from '#/services/modal'
import {
  SPEC_STEP_TO_SPECKIT,
  NODE_TYPE_TO_SPECKIT,
  SPEC_STEP_TO_OPENSPEC,
  NODE_TYPE_TO_OPENSPEC,
} from '#/services/specMap'

export type ExportTarget = 'speckit' | 'openspec'

export interface ExportOptions {
  /** 工作流/变更名称 */
  name?: string
  /** 是否合并完全相同的并行步骤，默认 false */
  mergeParallel?: boolean
  /** 知识库导出策略，默认 snapshot */
  knowledgeStrategy?: 'snapshot' | 'api'
  /** 纯文本快照大小阈值（字节），默认 2MB */
  snapshotThreshold?: number
}

export interface ExportArtifact {
  /** zip 包内相对路径 */
  path: string
  /** 文件内容 */
  content: string
}

export interface ExportResult {
  /** workflow.yml / schema.yaml 文本 */
  yaml: string
  /** 主工作流文件在 zip 中的路径 */
  workflowPath: string
  /** 输入物/占位文件列表 */
  artifacts: ExportArtifact[]
}

/** 生成合法的 step / 文件 id */
function toStepId(raw: string, fallback: string): string {
  const id = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return id || fallback
}

/** 读取节点的 Spec 阶段标记 */
function getSpecStep(node: Node): SpecStepKey | undefined {
  const step = (node.data as any)?.specStep
  return typeof step === 'string' ? (step as SpecStepKey) : undefined
}

/** 解析节点应使用的 Speckit 命令 */
function resolveSpeckitCommand(node: Node): string | undefined {
  return SPEC_STEP_TO_SPECKIT.get(getSpecStep(node) as SpecStepKey) || NODE_TYPE_TO_SPECKIT.get(node.type || '')
}

/** 解析节点应映射到的 OpenSpec artifact id */
function resolveOpenSpecArtifactId(node: Node): string | undefined {
  return SPEC_STEP_TO_OPENSPEC.get(getSpecStep(node) as SpecStepKey) || NODE_TYPE_TO_OPENSPEC.get(node.type || '')
}

/** 需要转成 gate 门禁步骤的节点类型 */
const GATE_NODE_TYPES = new Set<string>([NodeTypes.USER_INPUT, NodeTypes.ANSWER])

function resolveStepType(node: Node): 'command' | 'gate' {
  return GATE_NODE_TYPES.has(node.type || '') ? 'gate' : 'command'
}

/** 从节点 data 中提取模型别名（已剥离敏感字段） */
function resolveModelAlias(node: Node): string | undefined {
  const modal = stripModal((node.data as any)?.modal)
  return modal?.alias || modal?.name || modal?.id || undefined
}

/** 解析节点的输入参数 */
function resolveInput(_node: Node): Record<string, unknown> {
  // 当前统一使用 inputs.spec，后续可扩展为引用上游输出
  return { args: '{{ inputs.spec }}' }
}

/** 构建一个可用于合并比对的 step 描述对象 */
interface StepDescriptor {
  command: string
  integration: string
  model?: string
  input: Record<string, unknown>
  specStep?: SpecStepKey
}

function buildStepDescriptor(node: Node): StepDescriptor | null {
  const command = resolveSpeckitCommand(node)
  if (!command) return null
  return {
    command,
    integration: '{{ inputs.integration }}',
    model: resolveModelAlias(node),
    input: resolveInput(node),
    specStep: getSpecStep(node),
  }
}

function stepDescriptorKey(desc: StepDescriptor): string {
  return JSON.stringify({
    command: desc.command,
    integration: desc.integration,
    model: desc.model,
    input: desc.input,
    specStep: desc.specStep,
  })
}

/** 把节点解析为 workflow.yml step */
function nodeToStep(node: Node, index: number): Record<string, unknown> | null {
  const stepType = resolveStepType(node)
  const id = toStepId((node.data as any)?.title || '', `step-${index + 1}`)

  if (stepType === 'gate') {
    const question = (node.data as any)?.input?.prompt || (node.data as any)?.question
    return {
      id,
      type: 'gate',
      message: question || `Review before proceeding (from node "${(node.data as any)?.title || id}").`,
      options: ['approve', 'reject'],
      on_reject: 'abort',
    }
  }

  const command = resolveSpeckitCommand(node)
  if (!command) return null

  const step: Record<string, unknown> = { id, command, integration: '{{ inputs.integration }}' }
  const alias = resolveModelAlias(node)
  if (alias) step.model = alias
  const specStep = getSpecStep(node)
  if (specStep) step.spec_step = specStep
  step.input = resolveInput(node)
  return step
}

/** 基于拓扑排序结果计算每个节点的层号（最长前驱路径） */
function computeNodeLayers(sortedIds: string[], edges: Edge[]): Map<string, number> {
  const layer = new Map<string, number>()
  const predecessors = new Map<string, string[]>()
  for (const edge of edges) {
    if (!predecessors.has(edge.target)) predecessors.set(edge.target, [])
    predecessors.get(edge.target)!.push(edge.source)
  }
  for (const id of sortedIds) {
    let maxLayer = -1
    for (const pred of predecessors.get(id) || []) {
      if (layer.has(pred)) maxLayer = Math.max(maxLayer, layer.get(pred)!)
    }
    layer.set(id, maxLayer + 1)
  }
  return layer
}

/** 合并同一拓扑层中完全相同的 command step，保持原顺序 */
function mergeParallelSteps(
  nodes: Node[],
  layers: Map<string, number>,
  steps: Record<string, unknown>[],
  sortedIds: string[],
): Record<string, unknown>[] {
  const idToStepIndex = new Map<string, number>()
  sortedIds.forEach((id, i) => idToStepIndex.set(id, i))

  // 按层号分组，保持 sortedIds 内的相对顺序
  const layerGroups = new Map<number, string[]>()
  for (const id of sortedIds) {
    const l = layers.get(id) ?? 0
    if (!layerGroups.has(l)) layerGroups.set(l, [])
    layerGroups.get(l)!.push(id)
  }

  const merged: Record<string, unknown>[] = []
  let combineIndex = 0

  for (let l = 0; l <= Math.max(...layerGroups.keys(), 0); l++) {
    const layerIds = layerGroups.get(l) || []
    const groups = new Map<string, { desc: StepDescriptor; nodeIds: string[] }>()
    const layerItems: Array<{ type: 'single'; nodeId: string } | { type: 'group'; key: string }> = []

    for (const nodeId of layerIds) {
      const idx = idToStepIndex.get(nodeId)
      if (idx === undefined) continue
      const step = steps[idx]
      if (step.type === 'gate') {
        layerItems.push({ type: 'single', nodeId })
        continue
      }
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) {
        layerItems.push({ type: 'single', nodeId })
        continue
      }
      const desc = buildStepDescriptor(node)
      if (!desc) {
        layerItems.push({ type: 'single', nodeId })
        continue
      }
      const key = stepDescriptorKey(desc)
      if (!groups.has(key)) {
        groups.set(key, { desc, nodeIds: [] })
        layerItems.push({ type: 'group', key })
      }
      groups.get(key)!.nodeIds.push(nodeId)
    }

    // 保持首次出现顺序，去除重复 group key
    const seenKeys = new Set<string>()
    for (const item of layerItems) {
      if (item.type === 'single') {
        const idx = idToStepIndex.get(item.nodeId)!
        merged.push(steps[idx])
      } else if (!seenKeys.has(item.key)) {
        seenKeys.add(item.key)
        const group = groups.get(item.key)!
        if (group.nodeIds.length === 1) {
          const idx = idToStepIndex.get(group.nodeIds[0])!
          merged.push(steps[idx])
        } else {
          combineIndex++
          const { desc } = group
          const id = toStepId(`combine_${desc.command}_${combineIndex}`, `combine-${combineIndex}`)
          const step: Record<string, unknown> = {
            id,
            command: desc.command,
            integration: desc.integration,
          }
          if (desc.model) step.model = desc.model
          if (desc.specStep) step.spec_step = desc.specStep
          step.input = desc.input
          merged.push(step)
        }
      }
    }
  }

  return merged
}

/** 平台节点/连线 → Speckit workflow.yml 文本与配套产物 */
export function buildSpecKitWorkflow(
  nodes: Node[],
  edges: Edge[],
  options: ExportOptions = {},
): ExportResult {
  const { sortedIds } = topologicalSort(nodes, edges)
  const sorted = sortedIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is Node => Boolean(n))

  const steps: Record<string, unknown>[] = []
  let skipped = 0
  sorted.forEach((node, i) => {
    const step = nodeToStep(node, i)
    if (step) steps.push(step)
    else skipped++
  })

  let finalSteps = steps
  if (options.mergeParallel) {
    const layers = computeNodeLayers(sortedIds, edges)
    finalSteps = mergeParallelSteps(nodes, layers, steps, sortedIds)
  }

  const name = options.name?.trim() || 'picop-workflow'
  const doc: Record<string, unknown> = {
    schema_version: '1.0',
    workflow: {
      id: toStepId(name, 'picop-workflow'),
      name,
      version: '1.0.0',
      author: 'ai-workflow',
      description: `Exported from Picop (${nodes.length} nodes, ${edges.length} edges).`,
    },
    requires: {
      speckit_version: '>=0.8.5',
      integrations: { any: ['claude', 'copilot', 'gemini', 'opencode'] },
    },
    inputs: {
      spec: {
        type: 'string',
        required: true,
        prompt: 'Describe what you want to build',
      },
      integration: { type: 'string', default: 'auto' },
    },
    steps: finalSteps,
  }

  const comment = skipped > 0
    ? `# Note: ${skipped} control node(s) (if/loop/retry...) skipped - map expressions manually.\n`
    : ''

  const yaml = comment + dump(doc, { lineWidth: -1, noRefs: true })
  const workflowPath = `specify/workflows/${toStepId(name, 'picop-workflow')}/workflow.yml`

  return {
    yaml,
    workflowPath,
    artifacts: collectArtifacts(nodes, edges, name, 'speckit'),
  }
}

/** 把节点解析为 OpenSpec artifact */
function nodeToArtifact(node: Node): Record<string, unknown> | null {
  if (GATE_NODE_TYPES.has(node.type || '')) return null
  const artifactId = resolveOpenSpecArtifactId(node)
  if (!artifactId) return null

  const title = (node.data as any)?.title || artifactId
  const instruction = (node.data as any)?.instruction || ''
  return {
    id: artifactId,
    generates: `${artifactId}.md`,
    description: title,
    instruction:
      instruction || `Create the ${artifactId} document for this change (platform node: ${title}).`,
    requires: [],
  }
}

/** 平台节点/连线 → OpenSpec schema 文本与配套产物 */
export function buildOpenSpecWorkflow(
  nodes: Node[],
  edges: Edge[],
  options: ExportOptions = {},
): ExportResult {
  const { sortedIds } = topologicalSort(nodes, edges)
  const sorted = sortedIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is Node => Boolean(n))

  const artifacts: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const node of sorted) {
    const artifact = nodeToArtifact(node)
    if (!artifact) continue
    if (seen.has(artifact.id as string)) continue
    seen.add(artifact.id as string)
    artifacts.push(artifact)
  }

  artifacts.forEach((a, i) => {
    a.requires = i === 0 ? [] : [artifacts[i - 1].id as string]
  })

  const name = options.name?.trim() || 'picop-workflow'
  const doc: Record<string, unknown> = {
    name: toStepId(name, 'picop-workflow'),
    version: 1,
    description: name,
    artifacts,
  }

  if (artifacts.length > 0) {
    const last = artifacts[artifacts.length - 1]
    doc.apply = {
      requires: [last.id as string],
      tracks: `${last.id}.md`,
    }
  }

  const yaml = dump(doc, { lineWidth: -1, noRefs: true })
  const workflowPath = `openspec/changes/${toStepId(name, 'picop-workflow')}/schema.yml`

  return {
    yaml,
    workflowPath,
    artifacts: collectArtifacts(nodes, edges, name, 'openspec'),
  }
}

/** 解析目标平台生成主工作流文件 */
export function buildWorkflow(
  target: ExportTarget,
  nodes: Node[],
  edges: Edge[],
  options: ExportOptions = {},
): ExportResult {
  return target === 'openspec'
    ? buildOpenSpecWorkflow(nodes, edges, options)
    : buildSpecKitWorkflow(nodes, edges, options)
}

// ==================== 输入物/占位文件收集（纯路径与内容规划） ====================

const SPEC_STEP_TO_ARTIFACT_FILE: Record<SpecStepKey, string> = {
  spec: 'spec.md',
  plan: 'plan.md',
  research: 'research.md',
  'data-model': 'data-model.md',
  contracts: 'contracts.md',
  adr: 'adr.md',
  tasks: 'tasks.md',
  report: 'report.md',
}

const SPEC_STEP_TEMPLATE: Record<SpecStepKey, string> = {
  spec: '# 功能规格\n\n<!-- 由平台 spec 节点生成，请补充 FR/SC 与用户故事 -->\n',
  plan: '# 技术方案\n\n<!-- 由平台 plan 节点生成，请补充架构、模块、接口契约 -->\n',
  research: '# 调研分析\n\n<!-- 由平台 research 节点生成 -->\n',
  'data-model': '# 数据模型\n\n<!-- 由平台 data-model 节点生成 -->\n',
  contracts: '# 接口契约\n\n<!-- 由平台 contracts 节点生成 -->\n',
  adr: '# 架构决策记录\n\n<!-- 由平台 adr 节点生成 -->\n',
  tasks: '# 分批任务清单\n\n<!-- 由平台 tasks 节点生成，按 Batch 拆分 -->\n',
  report: '# 自检报告\n\n<!-- 由平台 report 节点生成 -->\n',
}

/** 根据节点类型/标记收集应打包的输入物路径与占位内容 */
function collectArtifacts(
  nodes: Node[],
  _edges: Edge[],
  workflowName: string,
  target: ExportTarget,
): ExportArtifact[] {
  const artifacts: ExportArtifact[] = []
  const baseDir = target === 'openspec'
    ? `openspec/changes/${toStepId(workflowName, 'picop-workflow')}`
    : `specify/workflows/${toStepId(workflowName, 'picop-workflow')}`

  const seenSkill = new Set<string>()
  const seenKnowledge = new Set<string>()

  for (const node of nodes) {
    const data = node.data as Record<string, any>

    // spec 阶段占位文件
    const specStep = getSpecStep(node)
    if (specStep && SPEC_STEP_TO_ARTIFACT_FILE[specStep]) {
      const fileName = SPEC_STEP_TO_ARTIFACT_FILE[specStep]
      if (!artifacts.some((a) => a.path === `${baseDir}/${fileName}`)) {
        artifacts.push({
          path: `${baseDir}/${fileName}`,
          content: SPEC_STEP_TEMPLATE[specStep],
        })
      }
    }

    // Skill 节点
    if (node.type === NodeTypes.SKILL && data.skillId && !seenSkill.has(data.skillId)) {
      seenSkill.add(data.skillId)
      artifacts.push({
        path: `${baseDir}/skills/${data.skillId}/SKILL.md`,
        content: `<!-- SKILL: ${data.skillId}，导出时从平台拉取 -->\n`,
      })
    }

    // Memory 节点
    if (node.type === NodeTypes.MEMORY && data.memoryPath) {
      const memoryFile = data.memoryPath.replace(/^\/+/, '')
      artifacts.push({
        path: `${baseDir}/${memoryFile}`,
        content: '<!-- memory 文件，导出时从平台拉取 -->\n',
      })
    }

    // Lark 文档节点
    if ((node.type === NodeTypes.LARK || node.type === NodeTypes.LARK_TEMPLATE) && data.url) {
      const fileName = toStepId(data.title || node.id, `lark-${node.id.slice(0, 8)}`) + '.md'
      artifacts.push({
        path: `${baseDir}/inputs/lark/${fileName}`,
        content: `<!-- Lark 文档: ${data.url}，导出时拉取 -->\n`,
      })
    }

    // Lark Wiki 遍历节点
    if (node.type === NodeTypes.LARK_WIKI_TRAVERSAL && data.spaceUrl) {
      artifacts.push({
        path: `${baseDir}/inputs/lark/wiki/${toStepId(data.spaceName || 'wiki', 'wiki')}.md`,
        content: `<!-- Lark 知识库: ${data.spaceUrl}，导出时拉取 -->\n`,
      })
    }

    // 知识库检索节点
    if (node.type === NodeTypes.KNOWLEDGE_RETRIEVAL) {
      const names: string[] = data.collectionNames?.length
        ? data.collectionNames
        : data.collectionName
          ? [data.collectionName]
          : []
      for (const name of names) {
        if (!name || seenKnowledge.has(name)) continue
        seenKnowledge.add(name)
        artifacts.push({
          path: `${baseDir}/knowledge/${toStepId(name, 'collection')}.md`,
          content: `<!-- Qdrant 集合: ${name}，导出时按策略拉取 -->\n`,
        })
      }
    }
  }

  return artifacts
}

/** 收集所有需要真实拉取内容的 artifact 路径描述 */
export function listCollectableArtifacts(nodes: Node[]): {
  skills: string[]
  memories: string[]
  larkUrls: string[]
  larkWikiSpaces: string[]
  knowledgeCollections: string[]
} {
  const skills = new Set<string>()
  const memories = new Set<string>()
  const larkUrls = new Set<string>()
  const larkWikiSpaces = new Set<string>()
  const knowledgeCollections = new Set<string>()

  for (const node of nodes) {
    const data = node.data as Record<string, any>
    if (node.type === NodeTypes.SKILL && data.skillId) skills.add(data.skillId)
    if (node.type === NodeTypes.MEMORY && data.memoryPath) memories.add(data.memoryPath)
    if ((node.type === NodeTypes.LARK || node.type === NodeTypes.LARK_TEMPLATE) && data.url) {
      larkUrls.add(data.url)
    }
    if (node.type === NodeTypes.LARK_WIKI_TRAVERSAL && data.spaceUrl) {
      larkWikiSpaces.add(data.spaceUrl)
    }
    if (node.type === NodeTypes.KNOWLEDGE_RETRIEVAL) {
      const names: string[] = data.collectionNames?.length
        ? data.collectionNames
        : data.collectionName
          ? [data.collectionName]
          : []
      for (const name of names) if (name) knowledgeCollections.add(name)
    }
  }

  return {
    skills: [...skills],
    memories: [...memories],
    larkUrls: [...larkUrls],
    larkWikiSpaces: [...larkWikiSpaces],
    knowledgeCollections: [...knowledgeCollections],
  }
}
