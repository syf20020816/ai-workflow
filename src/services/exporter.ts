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

export interface ExportResult {
  /** workflow.yml / schema.yaml 文本 */
  yaml: string
  /** 主工作流文件在 zip 中的路径 */
  workflowPath: string
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

/**
 * 输入类节点：内容以文件形式随 zip 导出，不映射为 command 步骤。
 * 标注 specStep 时，导出为运行时拉取步骤（shell），把外部内容落盘为对应 spec 产物。
 */
const INPUT_NODE_TYPES = new Set<string>([
  NodeTypes.LARK,
  NodeTypes.LARK_TEMPLATE,
  NodeTypes.SKILL,
  NodeTypes.MEMORY,
  NodeTypes.BMAD_AGENT,
  NodeTypes.LARK_WIKI_TRAVERSAL,
  NodeTypes.KNOWLEDGE_RETRIEVAL,
])

/** 输入类节点（含 userInput）是否标注了 specStep */
function isSpecStepProvider(node: Node): boolean {
  return Boolean(
    getSpecStep(node) &&
    (INPUT_NODE_TYPES.has(node.type || '') || node.type === NodeTypes.USER_INPUT),
  )
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

/** 节点输入物在 zip 内的相对路径（与 artifactCollector 写入路径保持一致） */

/** 清洗路径段：去除分隔符并阻断路径穿越（含 '..' 直接拒绝） */
export function safeSegment(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[/\\]/g, '-').trim()
  if (!cleaned || cleaned.includes('..')) return fallback
  return cleaned
}

/** 节点产物文件 slug：标题 + 节点 id 前 6 位，避免同名冲突 */
function nodeSlug(node: Node, fallbackPrefix: string): string {
  const title = (node.data as any)?.title || ''
  const suffix = node.id.replace(/-/g, '').slice(0, 6)
  return toStepId(`${title}-${suffix}`, `${fallbackPrefix}-${suffix}`)
}

/** userInput / agent 节点静态输入内容的导出路径 */
export function userInputArtifactPath(node: Node): string {
  return `inputs/user-input/${nodeSlug(node, 'input')}.md`
}

/** Skill 文件的导出路径 */
export function skillArtifactPath(skillId: string): string {
  return `skills/${safeSegment(skillId, 'skill')}/SKILL.md`
}

/** BMad 角色文件的导出路径 */
export function bmadArtifactPath(node: Node): string {
  const data = node.data as any
  const name = data?.agentId || data?.role || ''
  return `bmad/agents/${safeSegment(name, nodeSlug(node, 'bmad'))}.md`
}

/** Lark Wiki 快照的导出路径 */
export function wikiArtifactPath(node: Node): string {
  const data = node.data as any
  const name = data?.spaceName || data?.spaceUrl || node.id
  return `inputs/lark/wiki/${safeSegment(name, 'wiki')}.md`
}

/** Qdrant 集合快照的导出路径 */
export function knowledgeArtifactPath(collectionName: string): string {
  return `knowledge/${safeSegment(collectionName, 'collection')}.md`
}

/** memory 节点的默认记忆路径 */
const DEFAULT_MEMORY_PATH = 'memory/memory.md'

/** 读取 memory 节点引用的路径（带默认值） */
export function memoryArtifactPath(node: Node): string {
  const p = ((node.data as any)?.memoryPath || DEFAULT_MEMORY_PATH).replace(/^\/+/, '')
  return p.includes('..') ? DEFAULT_MEMORY_PATH : p
}

/** 读取知识库检索节点引用的集合名列表 */
function resolveKnowledgeCollections(node: Node): string[] {
  const data = node.data as Record<string, any>
  const names: string[] = data.collectionNames?.length
    ? data.collectionNames
    : data.collectionName
      ? [data.collectionName]
      : []
  return names.filter((n): n is string => typeof n === 'string' && Boolean(n))
}

/** specStep → 运行时拉取产物落盘文件名 */
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

/**
 * 输入类节点标注 specStep 时，构建运行时拉取步骤（shell）：
 * 把随 zip 导出的外部内容 / 静态内容落盘为对应 spec 产物文件。
 */
function buildFetchStep(node: Node, specStep: SpecStepKey, index: number): Record<string, unknown> | null {
  const data = node.data as Record<string, any>
  const fileName = SPEC_STEP_TO_ARTIFACT_FILE[specStep]
  if (!fileName) return null
  const id = toStepId(`fetch-${data?.title || ''}`, `fetch-step-${index + 1}`)
  let run: string | undefined

  switch (node.type) {
    case NodeTypes.LARK:
    case NodeTypes.LARK_TEMPLATE: {
      const url = data.url || data.templateUrl
      if (!url) return null
      run = `lark-cli docs +fetch --doc "${url}" --doc-format markdown --jq '.data.document.content' > ${fileName}`
      break
    }
    case NodeTypes.SKILL: {
      if (!data.skillId) return null
      run = `cp ${skillArtifactPath(data.skillId)} ${fileName}`
      break
    }
    case NodeTypes.MEMORY: {
      run = `cp ${memoryArtifactPath(node)} ${fileName}`
      break
    }
    case NodeTypes.BMAD_AGENT: {
      run = `cp ${bmadArtifactPath(node)} ${fileName}`
      break
    }
    case NodeTypes.LARK_WIKI_TRAVERSAL: {
      run = `cp ${wikiArtifactPath(node)} ${fileName}`
      break
    }
    case NodeTypes.KNOWLEDGE_RETRIEVAL: {
      const names = resolveKnowledgeCollections(node)
      if (names.length === 0) return null
      run = `cat ${names.map(knowledgeArtifactPath).join(' ')} > ${fileName}`
      break
    }
    case NodeTypes.USER_INPUT: {
      run = `cp ${userInputArtifactPath(node)} ${fileName}`
      break
    }
  }

  if (!run) return null
  return { id, type: 'shell', run, timeout: 60 }
}

/** 把节点解析为 workflow.yml step（可能产出多个：gate + 拉取步骤） */
function nodeToSteps(node: Node, index: number): Record<string, unknown>[] {
  const data = node.data as Record<string, any>
  const id = toStepId(data?.title || '', `step-${index + 1}`)

  if (GATE_NODE_TYPES.has(node.type || '')) {
    const question = data?.input?.prompt || data?.question
    const gate: Record<string, unknown> = {
      id,
      type: 'gate',
      message: question || `Review before proceeding (from node "${data?.title || id}").`,
      options: ['approve', 'reject'],
      on_reject: 'abort',
    }
    // userInput 标注 specStep 时，gate 后追加静态内容落盘步骤
    const specStep = getSpecStep(node)
    if (node.type === NodeTypes.USER_INPUT && specStep) {
      const fetch = buildFetchStep(node, specStep, index)
      if (fetch) return [gate, fetch]
    }
    return [gate]
  }

  // 输入类节点：内容随 zip 文件提供；标注 specStep 时生成运行时拉取步骤
  if (INPUT_NODE_TYPES.has(node.type || '')) {
    const specStep = getSpecStep(node)
    if (!specStep) return []
    const fetch = buildFetchStep(node, specStep, index)
    return fetch ? [fetch] : []
  }

  const command = resolveSpeckitCommand(node)
  if (!command) return []

  const step: Record<string, unknown> = { id, command, integration: '{{ inputs.integration }}' }
  const alias = resolveModelAlias(node)
  if (alias) step.model = alias
  const specStep = getSpecStep(node)
  if (specStep) step.spec_step = specStep
  step.input = resolveInput(node)
  return [step]
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
  stepNodeIds: string[],
): Record<string, unknown>[] {
  // 步骤索引按实际导出的 steps 对齐（输入节点等可能未生成 step）
  const idToStepIndex = new Map<string, number>()
  stepNodeIds.forEach((id, i) => idToStepIndex.set(id, i))

  // 按层号分组，保持 sortedIds 内的相对顺序
  const layerGroups = new Map<number, string[]>()
  for (const id of stepNodeIds) {
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
      // gate / shell 拉取步骤不参与合并
      if (step.type === 'gate' || step.type === 'shell') {
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

  // 输入节点提供的 specStep：该阶段产物由外部文档/静态内容提供，生成步骤跳过
  const providedSpecSteps = new Map<SpecStepKey, string>()
  for (const node of sorted) {
    if (!isSpecStepProvider(node)) continue
    const step = getSpecStep(node)!
    if (!providedSpecSteps.has(step)) {
      providedSpecSteps.set(step, (node.data as any)?.title || node.id)
    }
  }

  const steps: Record<string, unknown>[] = []
  const stepNodeIds: string[] = []
  let skipped = 0
  const overriddenNotes: string[] = []

  sorted.forEach((node, i) => {
    // 生成节点的 specStep 已由输入节点提供 → 跳过生成命令
    const specStep = getSpecStep(node)
    if (specStep && providedSpecSteps.has(specStep) && !isSpecStepProvider(node)) {
      const provider = providedSpecSteps.get(specStep)!
      overriddenNotes.push(
        `step "${(node.data as any)?.title || node.id}" (${specStep}) 的产物已由输入节点 "${provider}" 提供，跳过生成命令`,
      )
      return
    }

    const nodeSteps = nodeToSteps(node, i)
    if (nodeSteps.length === 0) {
      // 输入节点不映射为 command 步骤属预期行为，不计入控制节点跳过数
      if (!INPUT_NODE_TYPES.has(node.type || '')) skipped++
      return
    }
    for (const step of nodeSteps) {
      steps.push(step)
      stepNodeIds.push(node.id)
    }
  })

  let finalSteps = steps
  if (options.mergeParallel) {
    const layers = computeNodeLayers(sortedIds, edges)
    finalSteps = mergeParallelSteps(nodes, layers, steps, stepNodeIds)
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

  const notes: string[] = []
  if (skipped > 0) {
    notes.push(`# Note: ${skipped} control node(s) (if/loop/retry...) skipped - map expressions manually.`)
  }
  for (const note of overriddenNotes) {
    notes.push(`# Note: ${note}.`)
  }

  const yaml = (notes.length > 0 ? notes.join('\n') + '\n' : '') + dump(doc, { lineWidth: -1, noRefs: true })
  const workflowPath = `specify/workflows/${toStepId(name, 'picop-workflow')}/workflow.yml`

  return { yaml, workflowPath }
}

/** 输入类节点 → OpenSpec artifact 的拉取指引 */
function buildOpenSpecFetchInstruction(node: Node, artifactId: string): string {
  const data = node.data as Record<string, any>
  const file = `${artifactId}.md`
  switch (node.type) {
    case NodeTypes.LARK:
    case NodeTypes.LARK_TEMPLATE: {
      const url = data.url || data.templateUrl
      if (!url) return `Create the ${file} document for this change.`
      return `使用 lark-cli 拉取文档内容（lark-cli docs +fetch --doc "${url}" --doc-format markdown）并原样保存为 ${file}，不要自行生成或改写内容。`
    }
    case NodeTypes.SKILL:
      return `读取导出的 ${skillArtifactPath(String(data.skillId || ''))} 文件内容并保存为 ${file}。`
    case NodeTypes.MEMORY:
      return `读取导出的 ${memoryArtifactPath(node)} 文件内容并保存为 ${file}。`
    case NodeTypes.BMAD_AGENT:
      return `读取导出的 ${bmadArtifactPath(node)} 文件内容并保存为 ${file}。`
    case NodeTypes.LARK_WIKI_TRAVERSAL:
      return `读取导出的 ${wikiArtifactPath(node)} 快照内容并保存为 ${file}。`
    case NodeTypes.KNOWLEDGE_RETRIEVAL:
      return `读取导出的 knowledge/*.md 快照内容并整理保存为 ${file}。`
    default:
      return `Create the ${file} document for this change.`
  }
}

/** 把节点解析为 OpenSpec artifact */
function nodeToArtifact(node: Node): Record<string, unknown> | null {
  if (GATE_NODE_TYPES.has(node.type || '')) return null
  const artifactId = resolveOpenSpecArtifactId(node)
  if (!artifactId) return null

  const title = (node.data as any)?.title || artifactId
  const data = node.data as Record<string, any>
  let instruction = data?.instruction || ''

  // 输入类节点：产物由外部资源/导出文件提供，instruction 改为拉取指引
  if (isSpecStepProvider(node)) {
    instruction = buildOpenSpecFetchInstruction(node, artifactId)
  }

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

  // 输入节点提供的 specStep：生成节点的同名 artifact 跳过，以输入节点为准
  const providedArtifactIds = new Set<string>()
  for (const node of sorted) {
    if (!isSpecStepProvider(node)) continue
    const artifactId = SPEC_STEP_TO_OPENSPEC.get(getSpecStep(node)!)
    if (artifactId) providedArtifactIds.add(artifactId)
  }

  const artifacts: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const node of sorted) {
    // 生成节点的 specStep 已由输入节点提供 → 跳过，输入节点会产出该 artifact
    if (!isSpecStepProvider(node) && providedArtifactIds.has(resolveOpenSpecArtifactId(node) || '')) {
      continue
    }
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

  return { yaml, workflowPath }
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

// ==================== 输入物收集规划（纯函数，供 artifactCollector 消费） ====================

/** Lark 文档引用（不拉取全文，导出 URL 清单 + lark-cli 技能） */
export interface LarkRef {
  url: string
  kind: 'doc' | 'template'
  title: string
}

/** 需要收集真实内容的输入物清单 */
export interface CollectablePlan {
  /** userInput / agent 节点：静态输入内容（label/prompt/files/urls） */
  userInputNodes: Node[]
  /** Skill 节点引用的技能 ID */
  skills: string[]
  /** BMad 角色节点（内容内联在节点 data 中） */
  bmadNodes: Node[]
  /** memory 节点 */
  memoryNodes: Node[]
  /** Lark 文档/模板引用 */
  larkRefs: LarkRef[]
  /** Lark Wiki 遍历节点（全量快照） */
  wikiNodes: Node[]
  /** Qdrant 集合名 */
  knowledgeCollections: string[]
}

/** 收集所有需要真实内容的输入物清单 */
export function listCollectableArtifacts(nodes: Node[]): CollectablePlan {
  const userInputNodes: Node[] = []
  const skills = new Set<string>()
  const bmadNodes: Node[] = []
  const memoryNodes: Node[] = []
  const larkRefs: LarkRef[] = []
  const wikiNodes: Node[] = []
  const knowledgeCollections = new Set<string>()

  for (const node of nodes) {
    const data = node.data as Record<string, any>
    if (
      (node.type === NodeTypes.USER_INPUT || node.type === NodeTypes.AGENT) &&
      (data.input?.label || data.input?.prompt || data.input?.files?.length || data.input?.urls?.length)
    ) {
      userInputNodes.push(node)
    }
    if (node.type === NodeTypes.SKILL && data.skillId) skills.add(data.skillId)
    if (node.type === NodeTypes.BMAD_AGENT && (data.role || data.roleDescription || data.systemPrompt)) {
      bmadNodes.push(node)
    }
    if (node.type === NodeTypes.MEMORY) memoryNodes.push(node)
    if (node.type === NodeTypes.LARK && data.url) {
      larkRefs.push({ url: data.url, kind: 'doc', title: data.title || node.id })
    }
    if (node.type === NodeTypes.LARK_TEMPLATE && data.templateUrl) {
      larkRefs.push({ url: data.templateUrl, kind: 'template', title: data.title || node.id })
    }
    if (node.type === NodeTypes.LARK_WIKI_TRAVERSAL && data.spaceUrl) wikiNodes.push(node)
    if (node.type === NodeTypes.KNOWLEDGE_RETRIEVAL) {
      for (const name of resolveKnowledgeCollections(node)) knowledgeCollections.add(name)
    }
  }

  return {
    userInputNodes,
    skills: [...skills],
    bmadNodes,
    memoryNodes,
    larkRefs,
    wikiNodes,
    knowledgeCollections: [...knowledgeCollections],
  }
}
