import { NodeBuilder } from '#/types/builder'
import { NodeTypes } from '#/types'
import type { AppNode } from '#/types'
import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
// Vite ?raw 导入：将 markdown 文件作为纯文本字符串引入
import flowBuilderPrompt from '../../prompts/flowBuilder.md?raw'

/** AI 返回的工作流定义 */
export interface WorkflowDefinition {
  explanation: string
  nodes: Array<{
    type: string
    title: string
    data: Record<string, unknown>
  }>
  edges: Array<{
    source: number
    target: number
  }>
}

/** 对话消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
}

/** 节点类型 → NodeBuilder 方法名映射 */
const BUILDER_MAP: Partial<Record<string, (pos: { x: number; y: number }) => AppNode>> = {
  [NodeTypes.USER_INPUT]: NodeBuilder.userInput,
  [NodeTypes.AGENT]: NodeBuilder.agent,
  [NodeTypes.AI_OUTPUT]: NodeBuilder.aiOutput,
  [NodeTypes.ANSWER]: NodeBuilder.answer,
  [NodeTypes.BMAD_AGENT]: NodeBuilder.bmadAgent,
  [NodeTypes.LARK]: NodeBuilder.lark,
  [NodeTypes.LARK_TEMPLATE]: NodeBuilder.larkTemplate,
  [NodeTypes.CODE_AGENT]: NodeBuilder.codeAgent,
  [NodeTypes.SKILL]: NodeBuilder.skill,
  [NodeTypes.IF]: NodeBuilder.ifNode,
  [NodeTypes.IF_CONDITION]: NodeBuilder.ifCondition,
  [NodeTypes.LOOP]: NodeBuilder.loop,
  [NodeTypes.LOOP_CONDITION]: NodeBuilder.loopCondition,
  [NodeTypes.RETRY]: NodeBuilder.retry,
  [NodeTypes.MEMORY]: NodeBuilder.memory,
  [NodeTypes.KNOWLEDGE_RETRIEVAL]: NodeBuilder.knowledgeRetrieval,
  [NodeTypes.KNOWLEDGE_STORE]: NodeBuilder.knowledgeStore,
  [NodeTypes.LARK_WIKI_TRAVERSAL]: NodeBuilder.larkWikiTraversal,
  [NodeTypes.KEYWORD_AGENT]: NodeBuilder.keywordAgent,
  [NodeTypes.TASK_PLANNER]: NodeBuilder.taskPlanner,
  [NodeTypes.SELF_CHECK]: NodeBuilder.selfCheck,
}

/**
 * 从 AI 文本响应中提取 JSON（兼容 markdown 代码块包裹和裸 JSON）
 */
export function parseWorkflowResponse(text: string): WorkflowDefinition {
  // 去掉 markdown 代码块标记
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()
  const parsed = JSON.parse(jsonStr)

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('AI 响应中缺少 nodes 数组')
  }
  if (!parsed.edges || !Array.isArray(parsed.edges)) {
    parsed.edges = []
  }
  if (!parsed.explanation) {
    parsed.explanation = '工作流已生成'
  }

  return parsed as WorkflowDefinition
}

/**
 * 简单的自动布局：基于 BFS 拓扑排序，从左到右排列节点。
 * 同层节点垂直堆叠。
 */
function autoLayout(
  nodeCount: number,
  edges: Array<{ source: number; target: number }>,
): Array<{ x: number; y: number }> {
  const NODE_W = 280
  const NODE_H = 160
  const START_X = 100
  const START_Y = 100

  // 计算入度
  const inDegree = new Array(nodeCount).fill(0)
  const adjList: number[][] = Array.from({ length: nodeCount }, () => [])
  for (const e of edges) {
    if (e.source >= 0 && e.source < nodeCount && e.target >= 0 && e.target < nodeCount) {
      adjList[e.source].push(e.target)
      inDegree[e.target]++
    }
  }

  // BFS 分层
  const layer = new Array(nodeCount).fill(0)
  const queue: number[] = []
  for (let i = 0; i < nodeCount; i++) {
    if (inDegree[i] === 0) queue.push(i)
  }
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    for (const next of adjList[cur]) {
      layer[next] = Math.max(layer[next], layer[cur] + 1)
      inDegree[next]--
      if (inDegree[next] === 0) queue.push(next)
    }
  }

  // 按层分组，同层节点垂直排列
  const layerGroups = new Map<number, number[]>()
  for (let i = 0; i < nodeCount; i++) {
    const l = layer[i]
    const group = layerGroups.get(l)
    if (group) {
      group.push(i)
    } else {
      layerGroups.set(l, [i])
    }
  }

  const positions: Array<{ x: number; y: number }> = new Array(nodeCount)
  for (const [l, indices] of layerGroups.entries()) {
    const x = START_X + Number(l) * NODE_W
    indices.forEach((idx, rowIdx) => {
      const yOffset = (rowIdx - (indices.length - 1) / 2) * NODE_H
      positions[idx] = { x, y: START_Y + yOffset }
    })
  }

  // 兜底：未分配位置的节点（孤岛）
  for (let i = 0; i < nodeCount; i++) {
    if (!positions[i]) positions[i] = { x: START_X + i * NODE_W, y: START_Y }
  }

  return positions
}

/**
 * 将工作流定义应用到画布（清空并重建）
 */
export function applyWorkflow(def: WorkflowDefinition): void {
  const positions = autoLayout(def.nodes.length, def.edges)

  // 创建节点（使用 as unknown as Node 绕过联合类型收窄，与 addConnectNode 一致）
  const nodes = def.nodes.map((nodeDef, i) => {
    const builderFn = BUILDER_MAP[nodeDef.type]
    if (!builderFn) {
      throw new Error(`未知节点类型: ${nodeDef.type}`)
    }
    const pos = positions[i]
    const node = builderFn(pos)
    if (!node) {
      throw new Error(`节点创建失败: ${nodeDef.type}`)
    }
    const nodeData = node.data as Record<string, unknown>
    // 覆盖标题和自定义数据
    return {
      ...node,
      data: {
        ...nodeData,
        title: nodeDef.title || (nodeData.title as string | undefined),
        ...nodeDef.data,
      },
    }
  })

  // 创建边
  const edges = def.edges
    .filter((e) => nodes[e.source] && nodes[e.target])
    .map((e) => {
      const src = nodes[e.source]
      const tgt = nodes[e.target]
      return {
        id: `${src.id}-${tgt.id}`,
        source: src.id,
        target: tgt.id,
        type: 'nodeEdge',
      }
    })

  // 应用到 store（替换整个画布）
  const store = useNodeStore.getState()
  store.setNodes(nodes as unknown as any[])
  store.setEdges(edges)
  store.setCurrentNode(null)
}

/**
 * 序列化当前工作流为简化描述（发送给 AI 作为上下文）
 */
function serializeCurrentWorkflow(): string {
  const { nodes, edges } = useNodeStore.getState()
  if (nodes.length === 0) return '当前画布为空'

  const nodeDescs = nodes.map((n, i) => {
    const data = n.data
    const title = (data.title as string) || n.type || '未命名'
    return `  [${i}] type=${n.type}, title="${title}"`
  })

  const edgeDescs = edges.map((e) => {
    const srcIdx = nodes.findIndex((n) => n.id === e.source)
    const tgtIdx = nodes.findIndex((n) => n.id === e.target)
    return `  ${srcIdx} → ${tgtIdx}`
  })

  return `当前工作流状态：\n节点：\n${nodeDescs.join('\n')}\n连接：\n${edgeDescs.join('\n')}`
}

/**
 * 调用 AI 搭建工作流
 * @param message 用户需求描述
 * @param modelName 使用的模型 name
 * @param history 对话历史
 * @returns AI 的解释文本 + 工作流定义
 */
export async function buildWorkflow(
  message: string,
  modelName: string,
  history: ChatMessage[] = [],
): Promise<{ explanation: string; workflow: WorkflowDefinition }> {
  const model = useModelStore.getState().models.find((m) => m.name === modelName)
  if (!model) throw new Error(`模型 "${modelName}" 未找到`)
  if (!model.url) throw new Error(`模型 "${modelName}" 缺少 API URL`)

  // 构建对话消息
  const messages = history.map((m) => ({
    role: m.role,
    content: m.content,
  })) as Array<{ role: 'user' | 'assistant'; content: string }>

  // 当前工作流状态作为上下文
  const currentWorkflow = serializeCurrentWorkflow()
  const userMessage = `${message}\n\n--- 当前工作流状态 ---\n${currentWorkflow}`
  messages.push({ role: 'user', content: userMessage })

  const res = await fetch('/api/execute/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: {
        url: model.url,
        modelName: model.modelName,
        apiKey: model.apiKey,
        token: model.token,
      },
      messages,
      systemPrompt: flowBuilderPrompt,
      temperature: 0.3,
    }),
  })

  const data = await res.json()
  if (data.status !== 'success') {
    throw new Error(data.error || 'AI 调用失败')
  }

  const responseText: string = data.output.response
  const workflow = parseWorkflowResponse(responseText)

  return { explanation: workflow.explanation, workflow }
}

export { flowBuilderPrompt }
