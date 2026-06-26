import type { AppNode, NodeType } from '#/types'
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'

import type {
  NodeChange,
  Node,
  Edge,
  EdgeChange,
  OnConnect,
} from '@xyflow/react'
import { create } from 'zustand'
import { produce } from 'immer'

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
}))
