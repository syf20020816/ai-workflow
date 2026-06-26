import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
} from '@xyflow/react'
import type { Node, Edge, NodeProps } from '@xyflow/react'
import { useCallback } from 'react'
import { UserInputNode } from './node/user/input'
import { AgentNode } from './node/ai/agent'
import { AIOutputNode } from './node/ai/output'
import { AnswerNode } from './node/ai/answer'
import { BmadAgentNode } from './node/ai/bmad'
import { LarkNode } from './node/ai/lark'
import { EditPanel } from './panel/edit'
import { useNodeStore } from '#/store/node'

export const NODE_TYPES = {
  userInput: UserInputNode,
  agent: AgentNode,
  aiOutput: AIOutputNode,
  answer: AnswerNode,
  bmadAgent: BmadAgentNode,
  lark: LarkNode,
}

export function Flow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useNodeStore()

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      colorMode="light"
      nodeTypes={NODE_TYPES}
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  )
}
