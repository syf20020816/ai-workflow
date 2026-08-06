import type { AppNode } from '#/types'
import { NodeTypes } from '#/types'
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'

import type {
  NodeChange,
  Node,
  Edge,
  EdgeChange,
  OnConnect,
} from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import { create } from 'zustand'
import { produce } from 'immer'
import type { PipelineContext } from '#/types/engine'
import {
  createPipelineContext,
  executeWorkflow,
  resumeWorkflow,
} from '#/engine/workflow'
import { useGlobalStore } from './global'

/** 保存执行结果到后端 */
async function saveExecutionHistory(
  workflowId: string,
  workflowName: string,
  ctx: PipelineContext,
  globalMode: 'normal' | 'spec',
) {
  try {
    const nodeResults: Array<{
      nodeId: string
      nodeTitle: string
      status: 'success' | 'error'
      output: Record<string, any>
    }> = []
    for (const [nodeId, output] of Object.entries(ctx.nodeOutputs)) {
      nodeResults.push({
        nodeId,
        nodeTitle: '',
        status: ctx.nodeStatuses[nodeId] === 'success' ? 'success' : 'error',
        output: output || {},
      })
    }
    // 从日志中补充节点标题
    for (const result of nodeResults) {
      const log = ctx.logs.find((l) => l.nodeId === result.nodeId)
      if (log) result.nodeTitle = log.nodeTitle
    }
    await fetch('/api/workflow/exec-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId,
        workflowName,
        timestamp: String(Date.now()),
        status:
          ctx.globalStatus === 'completed'
            ? 'completed'
            : ctx.globalStatus === 'error'
              ? 'error'
              : ctx.globalStatus === 'paused'
                ? 'paused'
                : 'completed',
        globalMode,
        specDir: ctx.specRoot,
        nodeCount: nodeResults.length,
        nodeResults,
        logs: ctx.logs,
      }),
    })
  } catch {
    // 静默失败，不影响主流程
  }
}

/** 读取断点续跑状态（仅 globalStatus === 'paused' 时返回有效状态，P0-5） */
async function loadExecState(
  workflowId: string,
): Promise<{
  nodeOutputs: Record<string, Record<string, any>>
  nodeStatuses: Record<string, any>
  specRoot?: string
} | null> {
  try {
    const res = await fetch(
      `/api/workflow/exec-state?workflowId=${encodeURIComponent(workflowId)}`,
    )
    const json = await res.json()
    if (json.status === 'success' && json.state?.globalStatus === 'paused') {
      return {
        nodeOutputs: json.state.nodeOutputs || {},
        nodeStatuses: json.state.nodeStatuses || {},
        ...(json.state.specRoot ? { specRoot: json.state.specRoot } : {}),
      }
    }
  } catch {
    // 读取失败视为无断点
  }
  return null
}

/** 清除断点 checkpoint（用户重置执行状态时） */
async function clearExecStateFile(workflowId: string) {
  try {
    await fetch(
      `/api/workflow/exec-state?workflowId=${encodeURIComponent(workflowId)}`,
      { method: 'DELETE' },
    )
  } catch {
    // 忽略
  }
}

export interface UseNodeStoreProps {
  currentNode: AppNode
  setCurrentNode: (node: AppNode) => void
  deleteCurrentNode: () => void
  /** 使用 immer producer 直接修改当前节点的深层字段 */
  patchCurrentNode: (recipe: (draft: NonNullable<AppNode>) => void) => void
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange<Node>[]) => void
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void
  onConnect: OnConnect
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  // 添加连接节点，新节点会直接与currentNode连接起来
  addConnectNode: (node: Exclude<AppNode, null>) => void
  // 添加未连接节点，新节点不会与currentNode连接起来
  addUnConnectNode: (node: Exclude<AppNode, null>) => void
  /** 为当前 AgentNode 创建一个 BMadAgentNode 子节点并连接 */
  addBmadAgentForCurrent: (agent: {
    title: string
    name: string
    description: string
  }) => void
  /** 删除当前 AgentNode 连线的 BMadNode */
  removeConnectedBmad: () => void

  // ---- 执行引擎集成 ----
  /** 执行管线上下文 */
  pipelineContext: PipelineContext
  /** 执行全部工作流 */
  runAll: () => void
  /** 从指定节点开始执行子图 */
  runFrom: (nodeId: string) => void
  /** 恢复执行（Answer 节点用户回复后恢复，支持断点续跑） */
  resumeFrom: (nodeId: string, reply: string) => Promise<void>
  /** 重置执行状态 */
  resetExecution: () => void
  /** 删除指定边 */
  removeEdge: (edgeId: string) => void
  /** 清空面板 */
  clearPanel: () => void

  // ---- PIN 功能 ----
  /** 当前工作流 ID，用于定位 PIN 文件 */
  workflowId: string
  /** 设置工作流 ID */
  setWorkflowId: (id: string) => void
  /** 已 PIN 的输出：{ [nodeId]: output } (内存缓存，按节点隔离) */
  pinnedNodes: Partial<Record<string, Record<string, any>>>
  /** 保存当前节点的输出为固定节点（写入文件并加载到内存缓存） */
  pinNode: (nodeId: string, title: string) => Promise<void>
  /** 从文件加载固定节点数据到内存缓存（按 nodeId 隔离，只影响当前节点） */
  loadPinnedNode: (nodeId: string, data: Record<string, any>) => void
  /** 取消固定：仅从内存缓存移除，不删除文件（节点不再注入该输出） */
  unpinNode: (nodeId: string) => void
  /** 删除固定节点文件（持久化删除，不可恢复；nodeId 存在时只删该节点的文件，否则删除该类型所有文件） */
  deletePinnedFile: (nodeType: string, nodeId?: string) => Promise<void>
  /** 列出所有已固定的节点（读取文件系统，每个文件一条记录） */
  getPinnedNodeList: () => Promise<
    { nodeType: string; nodeId: string; title: string; savedAt: string }[]
  >
  /** 从固定节点开始执行（注入已 PIN 的输出，按 nodeId 匹配） */
  runFromWithPinned: (
    startNodeId: string,
    pinnedOverrides: Record<string, Record<string, any>>,
  ) => void
}

export const useNodeStore = create<UseNodeStoreProps>((set, get) => ({
  clearPanel: () => {
    set({
      nodes: [],
      edges: [],
      workflowId: `workflow_${Date.now()}`,
      currentNode: null,
      pinnedNodes: {},
      pipelineContext: createPipelineContext(),
    })
  },
  removeEdge: (edgeId) => {
    set({
      edges: get().edges.filter((e) => e.id !== edgeId),
    })
  },
  currentNode: null,
  // 删除当前节点，并从edges中和nodes删除
  deleteCurrentNode: () => {
    const current = get().currentNode
    if (!current) return
    set({
      nodes: get().nodes.filter((n) => n.id !== current.id),
      edges: get().edges.filter(
        (e) => e.source !== current.id && e.target !== current.id,
      ),
    })
    set({ currentNode: null })
  },
  setCurrentNode: (node: AppNode) => {
    if (!node) {
      set({ currentNode: null })
      return
    }
    const updateNode = get().nodes.find((n) => n.id === node.id)
    if (!updateNode) {
      set({ currentNode: null })
      return
    }

    const updatedNodes = get().nodes.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, ...node.data } } : n,
    )
    set({ currentNode: node, nodes: updatedNodes })
  },
  patchCurrentNode: (recipe) => {
    const current = get().currentNode
    if (!current) return

    const patched = produce(current, recipe)
    const updatedNodes = get().nodes.map((n) =>
      n.id === patched.id ? { ...n, data: { ...n.data, ...patched.data } } : n,
    )
    set({ currentNode: patched, nodes: updatedNodes })
  },
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    // React Flow 受控同步时会对节点发 replace change，用其内部节点对象整体替换，
    // 导致自定义 data 字段（如 specStep 阶段标记）丢失。这里保留 store 中已有的自定义字段：
    // 以新 item 的字段为准，仅补充 item 里没有、但 store 节点里存在的字段。
    const protectedChanges = changes.map((c) => {
      if (c.type !== 'replace') return c
      const prev = get().nodes.find((n) => n.id === c.id)
      if (!prev) return c
      const itemData = c.item.data
      const preserved = Object.fromEntries(
        Object.entries(prev.data).filter(([k]) => !(k in itemData)),
      )
      if (Object.keys(preserved).length === 0) return c
      return { ...c, item: { ...c.item, data: { ...preserved, ...itemData } } }
    }) as NodeChange[]

    set({
      nodes: applyNodeChanges(protectedChanges, get().nodes),
    })
    // 如果 currentNode 被删除，同步清空
    const currentNodeId = get().currentNode?.id
    if (currentNodeId) {
      const hasCurrentNode = get().nodes.some((n) => n.id === currentNodeId)
      if (!hasCurrentNode) {
        set({ currentNode: null })
      }
    }
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },
  onConnect: (connection) => {
    console.error(connection)
    set({
      edges: addEdge(
        {
          ...connection,
          type: 'nodeEdge',
        },
        get().edges,
      ),
    })
  },
  setNodes: (nodes) => {
    set({ nodes })
  },
  setEdges: (edges) => {
    set({ edges })
  },
  // 添加连接节点，新节点会直接与currentNode连接起来
  addConnectNode: (node: Exclude<AppNode, null>) => {
    const currentNode = get().currentNode
    set({
      nodes: [...get().nodes, node as unknown as Node],
      edges: !currentNode
        ? get().edges
        : [
            ...get().edges,
            {
              id: `${currentNode.id}-${node.id}`,
              source: currentNode.id,
              target: node.id,
              type: 'nodeEdge',
            },
          ],
    })
  },
  // 添加未连接节点，新节点不会与currentNode连接起来
  addUnConnectNode: (node: Exclude<AppNode, null>) => {
    set({
      nodes: [...get().nodes, node as unknown as Node],
    })
  },
  /** 为当前 AgentNode 创建一个 BMadAgentNode 子节点并连接 */
  addBmadAgentForCurrent: (agent) => {
    const current = get().currentNode
    if (!current) return

    const nodeEntry = get().nodes.find((n) => n.id === current.id)
    if (!nodeEntry) return

    // 获取 AgentNode 的模型配置
    const agentModal = (nodeEntry.data as any).modal

    // 提取模型配置中 bmad 需要的字段
    const bmadModal = agentModal
      ? {
          id: agentModal.id,
          name: agentModal.name,
          key: agentModal.key,
          url: agentModal.url,
          token: agentModal.token
            ? { min: agentModal.token.min, max: agentModal.token.max }
            : undefined,
        }
      : undefined

    // 检查当前 AgentNode 是否已经有连线的 BMadNode
    const existingEdge = get().edges.find(
      (e) =>
        e.source === current.id &&
        get().nodes.find((n) => n.id === e.target)?.type ===
          NodeTypes.BMAD_AGENT,
    )

    if (existingEdge) {
      // 已有连线 BMadNode → 更新其数据
      const existingNode = get().nodes.find((n) => n.id === existingEdge.target)
      if (existingNode) {
        const updatedNodes = get().nodes.map((n) =>
          n.id === existingNode.id
            ? {
                ...n,
                data: {
                  title: agent.title,
                  role: agent.title,
                  agentId: agent.name,
                  roleDescription: agent.description,
                  modal: bmadModal, // 继承模型配置
                },
              }
            : n,
        )
        // 同时更新当前节点（记录关联的 BMad agent 信息）
        const updatedCurrentNodes = updatedNodes.map((n) =>
          n.id === current.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  _connectedBmadAgent: agent.name,
                  modal: { ...(n.data as any).modal, alias: agent.title },
                },
              }
            : n,
        )
        set({
          nodes: updatedCurrentNodes,
          currentNode: updatedCurrentNodes.find(
            (n) => n.id === current.id,
          ) as any,
        })
      }
      return
    }

    // 没有已有连线 → 创建新的 BMadNode
    const id = uuidv4()
    const x = nodeEntry.position.x + 200
    const y = nodeEntry.position.y

    const bmadNode = {
      id,
      type: NodeTypes.BMAD_AGENT,
      position: { x, y },
      deletable: true,
      draggable: true,
      selectable: true,
      selected: false,
      data: {
        title: agent.title,
        role: agent.title,
        agentId: agent.name,
        roleDescription: agent.description,
        modal: bmadModal, // 从 AgentNode 继承模型配置
      },
    } as unknown as Node

    set({
      nodes: [...get().nodes, bmadNode],
      edges: [
        ...get().edges,
        {
          id: `${current.id}-${id}`,
          source: current.id,
          target: id,
          type: 'nodeEdge',
        },
      ],
    })
  },

  /** 删除当前 AgentNode 连线的 BMadNode */
  removeConnectedBmad: () => {
    const current = get().currentNode
    if (!current) return

    const existingEdge = get().edges.find(
      (e) =>
        e.source === current.id &&
        get().nodes.find((n) => n.id === e.target)?.type ===
          NodeTypes.BMAD_AGENT,
    )

    if (!existingEdge) return

    set({
      nodes: get().nodes.filter((n) => n.id !== existingEdge.target),
      edges: get().edges.filter(
        (e) => e.id !== existingEdge.id && e.source !== existingEdge.target,
      ),
    })
  },

  // ---- 执行引擎 ----
  pipelineContext: createPipelineContext(),
  workflowId: `workflow_${Date.now()}`,
  pinnedNodes: {},
  setWorkflowId: (id: string) => {
    set({ workflowId: id })
  },
  pinNode: async (nodeId: string, title: string) => {
    const { pipelineContext } = get()
    const output = pipelineContext.nodeOutputs[nodeId]
    if (!output) return

    // 通过节点 ID 找到节点类型，PIN 文件按类型存储（跨工作流共享）
    const node = get().nodes.find((n) => n.id === nodeId)
    const nodeType = node?.type
    if (!nodeType) return

    // 保存到文件（文件名 nodeType_nodeId.json，同类型会覆盖）
    await fetch('/api/workflow/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeType, nodeId, title, output }),
    })

    // 更新内存缓存（按 nodeId 隔离，只影响当前节点）
    set({ pinnedNodes: { ...get().pinnedNodes, [nodeId]: output } })
  },
  loadPinnedNode: (nodeId: string, data: Record<string, any>) => {
    // 按 nodeId 隔离，只影响当前节点
    set({ pinnedNodes: { ...get().pinnedNodes, [nodeId]: data } })
  },
  unpinNode: (nodeId: string) => {
    // 仅从内存缓存移除，不删除文件，节点不再注入该输出
    const updated = { ...get().pinnedNodes }
    delete updated[nodeId]
    set({ pinnedNodes: updated })
  },
  deletePinnedFile: async (nodeType: string, nodeId?: string) => {
    // 持久化删除文件（带 nodeId 只删该节点的文件，否则删除该类型所有文件）
    const params = new URLSearchParams({ nodeType })
    if (nodeId) params.set('nodeId', nodeId)
    await fetch(`/api/workflow/pin?${params.toString()}`, {
      method: 'DELETE',
    })
    // 清理内存中对应节点的缓存（未指定 nodeId 时清理所有该类型节点）
    const { nodes, pinnedNodes } = get()
    const updated = { ...pinnedNodes }
    for (const node of nodes) {
      if (node.type === nodeType && (!nodeId || node.id === nodeId)) {
        delete updated[node.id]
      }
    }
    set({ pinnedNodes: updated })
  },
  getPinnedNodeList: async () => {
    const res = await fetch('/api/workflow/pin')
    const json = await res.json()
    if (json.status === 'success') return json.data
    return []
  },
  runFromWithPinned: async (
    startNodeId: string,
    pinnedOverrides: Record<string, Record<string, any>>,
  ) => {
    const { nodes, edges, workflowId } = get()
    const workflowName = workflowId.replace(/^workflow_/, '')
    const globalMode = useGlobalStore.getState().globalMode
    const pipelineCtx = await executeWorkflow(
      nodes,
      edges,
      (ctx) => {
        set({ pipelineContext: { ...ctx } })
      },
      {
        startNodeId,
        nodeOutputOverrides: pinnedOverrides,
        globalMode,
        workflowId,
      },
    )
    // 执行结束后保存历史
    await saveExecutionHistory(workflowId, workflowName, pipelineCtx, globalMode)
  },
  runAll: async () => {
    const { nodes, edges, workflowId } = get()
    // 获取工作流名称
    const workflowName = workflowId.replace(/^workflow_/, '')
    const globalMode = useGlobalStore.getState().globalMode
    // 断点续跑（P0-5）：上次 paused 则恢复已完成节点，跳过执行；
    // 执行开始时间沿用已记录的（续跑场景不重置计时）
    const startedAt = get().pipelineContext.startedAt || Date.now()
    const restored = await loadExecState(workflowId)
    const pipelineCtx = await executeWorkflow(
      nodes,
      edges,
      (c) => {
        set({ pipelineContext: { ...c } })
      },
      {
        globalMode,
        workflowId,
        startedAt,
        ...(restored ? { restoreState: restored } : {}),
      },
    )
    // 执行结束后保存历史
    await saveExecutionHistory(workflowId, workflowName, pipelineCtx, globalMode)
  },
  runFrom: async (nodeId: string) => {
    const { nodes, edges, workflowId } = get()
    const workflowName = workflowId.replace(/^workflow_/, '')
    const globalMode = useGlobalStore.getState().globalMode
    // 断点续跑（P0-5）：上次 paused 则恢复已完成节点，保证该节点能看到上游输出
    const startedAt = get().pipelineContext.startedAt || Date.now()
    const restored = await loadExecState(workflowId)
    const pipelineCtx = await executeWorkflow(
      nodes,
      edges,
      (ctx) => {
        set({ pipelineContext: { ...ctx } })
      },
      {
        startNodeId: nodeId,
        globalMode,
        workflowId,
        startedAt,
        ...(restored ? { restoreState: restored } : {}),
      },
    )
    await saveExecutionHistory(workflowId, workflowName, pipelineCtx, globalMode)
  },
  resumeFrom: async (nodeId: string, reply: string) => {
    const { nodes, edges, pipelineContext, workflowId } = get()
    const globalMode = useGlobalStore.getState().globalMode
    // 断点续跑（P0-5）：恢复上次暂停时已完成的节点输出，从 Answer 节点继续
    const startedAt = pipelineContext.startedAt
    const restored = await loadExecState(workflowId)
    await resumeWorkflow(
      nodeId,
      reply,
      pipelineContext,
      nodes,
      edges,
      (ctx) => {
        set({ pipelineContext: { ...ctx } })
      },
      {
        globalMode,
        workflowId,
        ...(startedAt ? { startedAt } : {}),
        ...(restored ? { restoreState: restored } : {}),
      },
    )
  },
  resetExecution: () => {
    const { workflowId } = get()
    set({ pipelineContext: createPipelineContext() })
    // 重置执行状态时同时清除断点 checkpoint，避免下次运行误恢复
    void clearExecStateFile(workflowId)
  },
}))
