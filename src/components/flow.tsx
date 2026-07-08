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
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useNodeStore()

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
