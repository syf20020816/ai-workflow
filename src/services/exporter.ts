/**
 * 工作流导出服务
 *
 * 把平台画布节点/连线翻译为外部可执行格式：
 * - Speckit：workflow.yml（命令步骤流水线）
 * - OpenSpec：schema.yaml（artifacts 依赖图，含类型兜底与 tasks 自动补全）
 * - Spec：workflow.yaml（同构 artifacts 依赖图，只认手动 specStep 标注，无需安装框架）
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

export type ExportTarget = 'speckit' | 'openspec' | 'spec'

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

/** lark 输出节点（action=write）：产物投递目标，非输入源 */
function isLarkWriteNode(node: Node): boolean {
  return node.type === NodeTypes.LARK && (node.data as any)?.action === 'write'
}

/** 输入类节点判定（lark write 属于输出节点，排除） */
function isInputNode(node: Node): boolean {
  return INPUT_NODE_TYPES.has(node.type || '') && !isLarkWriteNode(node)
}

/**
 * 处理类节点：产出「生成型 artifact」，instruction 由节点 data 翻译。
 * （answer 是交互问答，归入 gate；knowledgeStore 是输出型节点）
 */
const PROCESSING_NODE_TYPES = new Set<string>([
  NodeTypes.AGENT,
  NodeTypes.CODE_AGENT,
  NodeTypes.TASK_PLANNER,
  NodeTypes.SELF_CHECK,
  NodeTypes.KEYWORD_AGENT,
  NodeTypes.AI_OUTPUT,
])

/** 处理类节点判定 */
function isProcessingNode(node: Node): boolean {
  return PROCESSING_NODE_TYPES.has(node.type || '')
}

/** 输入类节点（含 userInput）是否标注了 specStep */
function isSpecStepProvider(node: Node): boolean {
  return Boolean(
    getSpecStep(node) &&
    (isInputNode(node) || node.type === NodeTypes.USER_INPUT),
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

  // lark write 输出节点：生成产物投递 shell 步骤（把 specStep 产物写入飞书文档）
  if (isLarkWriteNode(node)) {
    const url = data?.url
    const specStep = getSpecStep(node)
    const fileName = specStep ? SPEC_STEP_TO_ARTIFACT_FILE[specStep] : undefined
    if (!url || !fileName) return []
    const mode = data?.writeMode === 'append' ? 'append' : 'overwrite'
    return [
      {
        id: toStepId(`deliver-${data?.title || ''}`, `deliver-${index + 1}`),
        type: 'shell',
        run: `lark-cli docs +update --doc "${url}" --command ${mode} --content @${fileName} --doc-format markdown`,
        timeout: 60,
      },
    ]
  }

  // 输入类节点：内容随 zip 文件提供；标注 specStep 时生成运行时拉取步骤
  if (isInputNode(node)) {
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
      // 输入/输出节点不映射为 command 步骤属预期行为，不计入控制节点跳过数
      if (!isInputNode(node) && !isLarkWriteNode(node)) skipped++
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

/** OpenSpec schema 在 zip 内的目录（输入物与 schema.yaml 同级存放） */
export function openSpecSchemaDir(workflowName: string): string {
  return `openspec/schemas/${toStepId(workflowName, 'picop-workflow')}`
}

/** 输入类节点 → OpenSpec artifact 的拉取指引（schemaDir 为输入物所在目录前缀） */
function buildOpenSpecFetchInstruction(node: Node, artifactId: string, schemaDir: string): string {
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
      return `读取导出的 ${schemaDir}/${skillArtifactPath(String(data.skillId || ''))} 文件内容并保存为 ${file}。`
    case NodeTypes.MEMORY:
      return `读取导出的 ${schemaDir}/${memoryArtifactPath(node)} 文件内容并保存为 ${file}。`
    case NodeTypes.BMAD_AGENT:
      return `读取导出的 ${schemaDir}/${bmadArtifactPath(node)} 文件内容并保存为 ${file}。`
    case NodeTypes.LARK_WIKI_TRAVERSAL:
      return `读取导出的 ${schemaDir}/${wikiArtifactPath(node)} 快照内容并保存为 ${file}。`
    case NodeTypes.KNOWLEDGE_RETRIEVAL:
      return `读取导出的 ${schemaDir}/knowledge/*.md 快照内容并整理保存为 ${file}。`
    case NodeTypes.USER_INPUT:
      return `读取导出的 ${schemaDir}/${userInputArtifactPath(node)} 内容并整理保存为 ${file}。`
    default:
      return `Create the ${file} document for this change.`
  }
}

/** 沿边 BFS 查找最近的满足条件的节点（向上找处理节点 / 向下找注入目标） */
function findNearestNode(
  start: Node,
  neighbors: Map<string, string[]>,
  nodeMap: Map<string, Node>,
  predicate: (n: Node) => boolean,
): Node | null {
  const visited = new Set<string>([start.id])
  const queue = [...(neighbors.get(start.id) || [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const n = nodeMap.get(id)
    if (!n) continue
    if (predicate(n)) return n
    queue.push(...(neighbors.get(id) || []))
  }
  return null
}

/** 输入类节点的导出物引用文本（供处理节点 instruction 的「输入上下文」引用） */
function inputNodeRef(node: Node, schemaDir: string): string | undefined {
  const data = node.data as Record<string, any>
  switch (node.type) {
    case NodeTypes.LARK:
    case NodeTypes.LARK_TEMPLATE: {
      if (isLarkWriteNode(node)) return undefined
      const url = data.url || data.templateUrl
      if (!url) return undefined
      return `Lark 文档「${data.title || url}」：${url}（lark-cli docs +fetch --doc "${url}" --doc-format markdown 拉取）`
    }
    case NodeTypes.SKILL:
      return data.skillId
        ? `${schemaDir}/${skillArtifactPath(String(data.skillId))}（技能指引：${data.skillName || data.skillId}）`
        : undefined
    case NodeTypes.MEMORY:
      return `${schemaDir}/${memoryArtifactPath(node)}（项目记忆）`
    case NodeTypes.LARK_WIKI_TRAVERSAL:
      return `${schemaDir}/${wikiArtifactPath(node)}（Lark Wiki 快照）`
    case NodeTypes.KNOWLEDGE_RETRIEVAL: {
      const names = resolveKnowledgeCollections(node)
      return names.length > 0
        ? `${schemaDir}/knowledge/*.md（知识库快照：${names.join(', ')}）`
        : undefined
    }
    case NodeTypes.USER_INPUT:
      return `${schemaDir}/${userInputArtifactPath(node)}（用户输入）`
    default:
      return undefined
  }
}

/** 收集节点的全部上游输入类节点引用（沿边递归遍历祖先） */
function collectUpstreamInputRefs(
  node: Node,
  preds: Map<string, string[]>,
  nodeMap: Map<string, Node>,
  schemaDir: string,
): string[] {
  const refs: string[] = []
  const visited = new Set<string>([node.id])
  const queue = [...(preds.get(node.id) || [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const n = nodeMap.get(id)
    if (!n) continue
    const ref = inputNodeRef(n, schemaDir)
    if (ref) refs.push(ref)
    queue.push(...(preds.get(id) || []))
  }
  return refs
}

/** 处理类节点 → 生成型 artifact 的 instruction */
function buildProcessingInstruction(
  node: Node,
  artifactId: string,
  schemaDir: string,
  preds: Map<string, string[]>,
  nodeMap: Map<string, Node>,
  nodeDeliveries: Array<{ url: string; mode: string }>,
): string {
  const data = node.data as Record<string, any>
  const title = data?.title || artifactId
  const parts: string[] = []

  switch (node.type) {
    case NodeTypes.CODE_AGENT: {
      const lines = [data.instruction || data.description || '分析项目代码并输出技术文档。']
      if (data.projectPath) {
        lines.push(
          `项目路径：${data.projectPath}${data.branch ? `（分支 ${data.branch}）` : ''}，本地执行时直接读取项目源码。`,
        )
      }
      if (data.appMapPath) {
        lines.push(`参考应用映射表:${data.appMapPath}(如果有)`)
      }
      parts.push(lines.join('\n'))
      break
    }
    case NodeTypes.TASK_PLANNER:
      parts.push(
        [
          data.instruction || '',
          `基于上游产物拆解出可勾选的实施任务清单（- [ ] 1.x 子任务格式，含验收标准引用）。`,
        ]
          .filter(Boolean)
          .join('\n'),
      )
      break
    case NodeTypes.SELF_CHECK:
      parts.push(
        [
          data.instruction || '',
          '对全部已产出文档执行跨产物一致性检查，输出问题清单与修订建议。',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      break
    default:
      parts.push(data.instruction || data.description || `完成「${title}」并输出 ${artifactId}.md。`)
  }

  // 输入上下文：上游输入类节点（含本节点内嵌 userInput 静态输入）的导出物引用
  const refs = collectUpstreamInputRefs(node, preds, nodeMap, schemaDir)
  const embedded = data.input?.label || data.input?.prompt || data.input?.files?.length || data.input?.urls?.length
  if (embedded) refs.unshift(`${schemaDir}/${userInputArtifactPath(node)}（本节点输入）`)
  if (refs.length > 0) {
    parts.push('## 输入上下文\n' + refs.map((r) => `- ${r}`).join('\n'))
  }

  // 产物投递：lark write 反向挂接到本节点
  for (const d of nodeDeliveries) {
    parts.push(
      `## 产物投递\n生成完成后使用 lark-cli 将 ${artifactId}.md 全文写入飞书文档：\nlark-cli docs +update --doc "${d.url}" --command ${d.mode} --content @${artifactId}.md --doc-format markdown`,
    )
  }

  return parts.join('\n\n')
}

/** Spec 导出：变更目录（md 产物与输入物所在层级） */
export function specChangeDir(workflowName: string): string {
  return `spec/changes/${toStepId(workflowName, 'picop-workflow')}`
}

/** artifacts 流水线配置（OpenSpec 与 Spec 导出共用） */
interface ArtifactsPipelineConfig {
  /** artifact id 解析：'openspec' 用映射表（plan→design），'step' 直接用 specStep key（plan→plan） */
  artifactIdMode: 'openspec' | 'step'
  /** 未标注 specStep 的处理节点是否用类型兜底产出 artifact（Spec 导出为 false，只认手动标注） */
  typeFallback: boolean
  /** lark write 节点是否必须标注 specStep 才参与挂接（Spec 导出为 true） */
  writeNeedsSpecStep: boolean
  /** 链尾是否自动补全 tasks artifact（Spec 导出为 false） */
  autoTasks: boolean
  /** 输入物所在目录前缀（instruction 引用路径） */
  schemaDir: string
}

/**
 * artifacts 依赖图构建流水线（OpenSpec / Spec 导出共用）：
 * 输入节点（标注 specStep）→ 拉取型 artifact；处理节点 → 生成型 artifact；
 * lark write → 反向挂接投递；bmadAgent → 角色注入；可选 tasks 自动补全。
 */
function buildArtifactsPipeline(
  nodes: Node[],
  edges: Edge[],
  config: ArtifactsPipelineConfig,
): Record<string, unknown>[] {
  const { sortedIds } = topologicalSort(nodes, edges)
  const sorted = sortedIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is Node => Boolean(n))

  const stepToArtifactId = (step: SpecStepKey): string =>
    config.artifactIdMode === 'openspec' ? SPEC_STEP_TO_OPENSPEC.get(step) || step : step

  // 前驱 / 后继邻接表
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  for (const edge of edges) {
    if (!preds.has(edge.target)) preds.set(edge.target, [])
    preds.get(edge.target)!.push(edge.source)
    if (!succs.has(edge.source)) succs.set(edge.source, [])
    succs.get(edge.source)!.push(edge.target)
  }
  const nodeMap = new Map(sorted.map((n) => [n.id, n]))

  // ---- 1. lark write 反向挂接：找上游最近处理节点，specStep 与投递指令转移给它 ----
  const mountSpecStep = new Map<string, SpecStepKey>()
  const deliveries = new Map<string, Array<{ url: string; mode: string }>>()
  const orphanWrites: Array<{ url: string; mode: string; title: string }> = []
  for (const node of sorted) {
    if (!isLarkWriteNode(node)) continue
    if (config.writeNeedsSpecStep && !getSpecStep(node)) continue
    const url = (node.data as any)?.url
    if (!url) continue
    const mode = ((node.data as any)?.writeMode === 'append' ? 'append' : 'overwrite')
    const upstream = findNearestNode(node, preds, nodeMap, isProcessingNode)
    if (upstream) {
      const list = deliveries.get(upstream.id) || []
      list.push({ url, mode })
      deliveries.set(upstream.id, list)
      const step = getSpecStep(node)
      if (step && !getSpecStep(upstream) && !mountSpecStep.has(upstream.id)) {
        mountSpecStep.set(upstream.id, step)
      }
    } else {
      orphanWrites.push({ url, mode, title: (node.data as any)?.title || node.id })
    }
  }

  // ---- 2. 输入节点提供的 specStep（拉取型 artifact 优先） ----
  const providedArtifactIds = new Set<string>()
  for (const node of sorted) {
    if (!isSpecStepProvider(node)) continue
    const artifactId = stepToArtifactId(getSpecStep(node)!)
    if (artifactId) providedArtifactIds.add(artifactId)
  }

  // ---- 3. 生成 artifacts：输入拉取型 + 处理生成型 ----
  const artifacts: Record<string, unknown>[] = []
  const seenIds = new Set<string>()
  const artifactByNode = new Map<string, Record<string, unknown>>()

  for (const node of sorted) {
    if (isLarkWriteNode(node)) continue // 已反向挂接 / 降级为独立 delivery artifact
    if (node.type === NodeTypes.KNOWLEDGE_STORE) continue // 输出型节点，不产出 artifact
    if (node.type === NodeTypes.ANSWER) continue // 交互问答 gate

    // userInput + specStep：静态内容直接作为产物
    if (node.type === NodeTypes.USER_INPUT) {
      const step = getSpecStep(node)
      if (!step) continue
      const artifactId = stepToArtifactId(step)
      if (!artifactId || seenIds.has(artifactId)) continue
      seenIds.add(artifactId)
      artifacts.push({
        id: artifactId,
        generates: `${artifactId}.md`,
        description: (node.data as any)?.title || artifactId,
        instruction: buildOpenSpecFetchInstruction(node, artifactId, config.schemaDir),
        requires: [] as string[],
      })
      continue
    }

    // 输入类节点（lark read / skill / memory / bmad / wiki / 知识库）：标注 specStep 时产出拉取型 artifact
    if (isInputNode(node)) {
      const step = getSpecStep(node)
      if (!step) continue
      const artifactId = stepToArtifactId(step)
      if (!artifactId || seenIds.has(artifactId)) continue
      seenIds.add(artifactId)
      artifacts.push({
        id: artifactId,
        generates: `${artifactId}.md`,
        description: (node.data as any)?.title || artifactId,
        instruction: buildOpenSpecFetchInstruction(node, artifactId, config.schemaDir),
        requires: [] as string[],
      })
      continue
    }

    // 处理类节点：生成型 artifact
    if (!isProcessingNode(node)) continue
    const ownStep = getSpecStep(node)
    const mountedStep = mountSpecStep.get(node.id)
    // artifact id 解析优先级：自身 specStep > 反向挂接 specStep > 类型兜底 > 标题 slug
    let artifactId: string
    if (ownStep) artifactId = stepToArtifactId(ownStep) || nodeSlug(node, 'artifact')
    else if (mountedStep) artifactId = stepToArtifactId(mountedStep) || nodeSlug(node, 'artifact')
    else if (config.typeFallback)
      artifactId = NODE_TYPE_TO_OPENSPEC.get(node.type || '') || nodeSlug(node, 'artifact')
    else continue // Spec 导出：只认手动标注
    // 类型兜底 id 被占用时（多个 agent 争抢 proposal），降级为标题 slug
    if (seenIds.has(artifactId)) artifactId = nodeSlug(node, 'artifact')
    if (seenIds.has(artifactId)) continue
    // specStep 产物已由输入节点提供（拉取型优先）→ 跳过生成
    if ((ownStep || mountedStep) && providedArtifactIds.has(artifactId)) continue

    const artifact = {
      id: artifactId,
      generates: `${artifactId}.md`,
      description: (node.data as any)?.title || artifactId,
      instruction: buildProcessingInstruction(
        node,
        artifactId,
        config.schemaDir,
        preds,
        nodeMap,
        deliveries.get(node.id) || [],
      ),
      requires: [] as string[],
    }
    seenIds.add(artifactId)
    artifacts.push(artifact)
    artifactByNode.set(node.id, artifact)
  }

  // ---- 4. bmadAgent 角色注入：无 specStep 的角色节点，约束注入下游最近处理节点 ----
  for (const node of sorted) {
    if (node.type !== NodeTypes.BMAD_AGENT || getSpecStep(node)) continue
    const target = findNearestNode(node, succs, nodeMap, isProcessingNode)
    const artifact = target ? artifactByNode.get(target.id) : undefined
    if (!artifact) continue
    const data = node.data as Record<string, any>
    const roleHeader =
      `## 角色\n以 ${data.role || 'BMad Agent'}（${data.agentId || node.id}）身份执行：` +
      `${data.roleDescription || data.systemPrompt || ''}\n完整角色定义见 ${config.schemaDir}/${bmadArtifactPath(node)}\n\n`
    artifact.instruction = roleHeader + artifact.instruction
  }

  // ---- 5. 无上游处理节点的 lark write：降级为独立 delivery artifact ----
  for (const w of orphanWrites) {
    if (artifacts.length === 0) break
    const id = toStepId(`deliver-${w.title}`, 'deliver')
    if (seenIds.has(id)) continue
    seenIds.add(id)
    artifacts.push({
      id,
      generates: `${id}.md`,
      description: `将上游产物写入飞书文档（${w.title}）`,
      instruction:
        `读取上游产物文档全文，使用 lark-cli 写入飞书文档：\n` +
        `lark-cli docs +update --doc "${w.url}" --command ${w.mode} --content @<上游产物文件> --doc-format markdown\n` +
        `本步骤不产生新内容，仅投递。`,
      requires: [] as string[],
    })
  }

  // ---- 6. tasks artifact 自动补全：保证 /opsx:apply 可执行（OpenSpec 专属） ----
  if (config.autoTasks) {
    const hasTasks = seenIds.has('tasks') || sorted.some((n) => getSpecStep(n) === 'tasks')
    if (!hasTasks && artifacts.length > 0) {
      const lastId = artifacts[artifacts.length - 1].id as string
      seenIds.add('tasks')
      artifacts.push({
        id: 'tasks',
        generates: 'tasks.md',
        description: '实施任务清单（自动补全）',
        instruction: `基于 ${lastId}.md 拆解出可勾选的实施任务清单（- [ ] 1.x 子任务格式，含验收标准引用）。`,
        requires: [] as string[],
      })
    }
  }

  // ---- 7. requires 依赖链（拓扑顺序） ----
  artifacts.forEach((a, i) => {
    a.requires = i === 0 ? [] : [artifacts[i - 1].id as string]
  })

  return artifacts
}

/** 平台节点/连线 → OpenSpec schema 文本与配套产物 */
export function buildOpenSpecWorkflow(
  nodes: Node[],
  edges: Edge[],
  options: ExportOptions = {},
): ExportResult {
  const name = options.name?.trim() || 'picop-workflow'
  const schemaDir = openSpecSchemaDir(name)
  const artifacts = buildArtifactsPipeline(nodes, edges, {
    artifactIdMode: 'openspec',
    typeFallback: true,
    writeNeedsSpecStep: false,
    autoTasks: true,
    schemaDir,
  })

  const doc: Record<string, unknown> = {
    name: toStepId(name, 'picop-workflow'),
    version: 1,
    description: name,
    artifacts,
  }

  if (artifacts.length > 0) {
    // apply 优先跟踪 tasks（/opsx:apply 按任务清单实施）
    const tracked = artifacts.find((a) => a.id === 'tasks') || artifacts[artifacts.length - 1]
    doc.apply = {
      requires: [tracked.id as string],
      tracks: `${tracked.id}.md`,
    }
  }

  const yaml = dump(doc, { lineWidth: -1, noRefs: true })
  // schema 放 openspec/schemas/<name>/schema.yaml，输入物同级存放
  const workflowPath = `${schemaDir}/schema.yaml`

  return { yaml, workflowPath }
}

/**
 * Spec 导出：与 OpenSpec 同构的 artifacts 依赖图，差异：
 * - artifact id 直接用 specStep key（plan.md 而非 design.md）
 * - 只认手动标注 specStep 的节点，不做类型兜底 / tasks 自动补全
 * - 无 openspec 目录约定（config.yaml / archive），无需安装框架，任意 agent 读 workflow.yaml 即可执行
 */
export function buildSpecWorkflow(
  nodes: Node[],
  edges: Edge[],
  options: ExportOptions = {},
): ExportResult {
  const name = options.name?.trim() || 'picop-workflow'
  const changeDir = specChangeDir(name)
  const artifacts = buildArtifactsPipeline(nodes, edges, {
    artifactIdMode: 'step',
    typeFallback: false,
    writeNeedsSpecStep: true,
    autoTasks: false,
    schemaDir: changeDir,
  })

  const doc: Record<string, unknown> = {
    name: toStepId(name, 'picop-workflow'),
    version: 1,
    description: name,
    artifacts,
  }

  const yaml = dump(doc, { lineWidth: -1, noRefs: true })
  // workflow.yaml 放 spec/changes/<name>/specs/<domain>/（domain 为导出时用户定义的工作流名）
  const workflowPath = `${changeDir}/specs/${toStepId(name, 'picop-workflow')}/workflow.yaml`

  return { yaml, workflowPath }
}

/** 解析目标平台生成主工作流文件 */
export function buildWorkflow(
  target: ExportTarget,
  nodes: Node[],
  edges: Edge[],
  options: ExportOptions = {},
): ExportResult {
  if (target === 'openspec') return buildOpenSpecWorkflow(nodes, edges, options)
  if (target === 'spec') return buildSpecWorkflow(nodes, edges, options)
  return buildSpecKitWorkflow(nodes, edges, options)
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
    if (node.type === NodeTypes.LARK && data.url && !isLarkWriteNode(node)) {
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
