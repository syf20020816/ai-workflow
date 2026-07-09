import { useEffect } from 'react'
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'

import { UserInputNode } from './node/user/input'
import { AgentNode } from './node/ai/agent'
import { AIOutputNode } from './node/ai/output'
import { AnswerNode } from './node/ai/answer'
import { BmadAgentNode } from './node/ai/bmad'
import { LarkNode } from './node/ai/lark'

import { useNodeStore } from '#/store/node'
import { NodeEdge } from './edge'
import { AddNodeBtn } from './node/edge/add'

export const NODE_TYPES = {
  userInput: UserInputNode,
  agent: AgentNode,
  aiOutput: AIOutputNode,
  answer: AnswerNode,
  bmadAgent: BmadAgentNode,
  lark: LarkNode,
}

const EDGE_TYPES = {
  nodeEdge: NodeEdge,
}

export function Flow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, removeConnectedBmad, setCurrentNode } =
    useNodeStore()

  // 监听 BMad 断开事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.nodeId) {
        // 先设置断开的目标 BMadNode 为当前节点，再删除
        const bmadNode = nodes.find((n) => n.id === detail.nodeId)
        if (bmadNode) {
          setCurrentNode(bmadNode as any)
          removeConnectedBmad()
        }
      }
    }
    window.addEventListener('bmad:disconnect', handler)
    return () => window.removeEventListener('bmad:disconnect', handler)
  }, [nodes, removeConnectedBmad, setCurrentNode])

  return (
    <AddNodeBtn trigger={['contextMenu']}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="light"
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        deleteKeyCode="Delete"
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </AddNodeBtn>
  )
}
