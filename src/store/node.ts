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
import { createPipelineContext, executeWorkflow, resumeWorkflow } from '#/engine/workflow'

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
  /** 为当前 AgentNode 创建一个 BMadAgentNode 子节点并连接 */
  addBmadAgentForCurrent: (agent: { title: string; name: string; description: string }) => void

  // ---- 执行引擎集成 ----
  /** 执行管线上下文 */
  pipelineContext: PipelineContext
  /** 执行全部工作流 */
  runAll: () => void
  /** 从指定节点开始执行子图 */
  runFrom: (nodeId: string) => void
  /** 恢复执行（Answer 节点用户回复后恢复） */
  resumeFrom: (nodeId: string, reply: string) => void
  /** 重置执行状态 */
  resetExecution: () => void
}

export const useNodeStore = create<UseNodeStoreProps>((set, get) => ({
  currentNode: null,
  // 删除当前节点，并从edges中和nodes删除
  deleteCurrentNode: () => {
    const current = get().currentNode
    if (!current) return
    set({
      nodes: get().nodes.filter((n) => n.id !== current.id),
      edges: get().edges.filter((e) => e.source !== current.id && e.target !== current.id),
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
      n.id === node.id ? { ...n, data: node.data } : n,
    )
    set({ currentNode: node, nodes: updatedNodes })
  },
  patchCurrentNode: (recipe) => {
    const current = get().currentNode
    if (!current) return

    const patched = produce(current, recipe)
    const updatedNodes = get().nodes.map((n) =>
      n.id === patched.id ? { ...n, data: patched.data } : n,
    )
    set({ currentNode: patched, nodes: updatedNodes })
  },
  nodes: [
    {
      id: 'node1',
      type: 'userInput',
      data: { title: '用户输入节点' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'node2',
      type: 'agent',
      data: { title: '智能体节点' },
      position: { x: 300, y: 200 },
    },
  ],
  edges: [],

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    })
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
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
              type: 'connect',
            },
          ],
    })
  },
  /** 为当前 AgentNode 创建一个 BMadAgentNode 子节点并连接 */
  addBmadAgentForCurrent: (agent) => {
    const current = get().currentNode
    if (!current) return

    const nodeEntry = get().nodes.find((n) => n.id === current.id)
    if (!nodeEntry) return

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
        roleDescription: agent.description,
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
          type: 'connect',
        },
      ],
    })
  },

  // ---- 执行引擎 ----
  pipelineContext: createPipelineContext(),
  runAll: () => {
    const { nodes, edges } = get()
    executeWorkflow(nodes, edges, (ctx) => {
      set({ pipelineContext: { ...ctx } })
    })
  },
  runFrom: (nodeId: string) => {
    const { nodes, edges } = get()
    executeWorkflow(nodes, edges, (ctx) => {
      set({ pipelineContext: { ...ctx } })
    }, { startNodeId: nodeId })
  },
  resumeFrom: (nodeId: string, reply: string) => {
    const { nodes, edges, pipelineContext } = get()
    resumeWorkflow(nodeId, reply, pipelineContext, nodes, edges, (ctx) => {
      set({ pipelineContext: { ...ctx } })
    })
  },
  resetExecution: () => {
    set({ pipelineContext: createPipelineContext() })
  },
}))
