import { createFileRoute } from '@tanstack/react-router'
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useState } from 'react'

export const Route = createFileRoute('/')({ component: App })

export interface Node {
  id: string
  type: string
  data: { label: string }
  position: { x: number; y: number }
}

export interface Edge {
  id: string
  source: string
  target: string
  type?: 'smoothstep'
  label?: string
}

function App() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'node1',
      type: 'input',
      data: { label: 'Node 1' },
      position: { x: 100, y: 100 },
    },
    {
      id: 'node2',
      type: 'output',
      data: { label: 'Node 2' },
      position: { x: 400, y: 300 },
    },
  ])

  const [edges, setEdges] = useState<Edge[]>([
    {
      id: 'node1-node2',
      source: 'node1',
      target: 'node2',
    },
  ])

  const onNodesChange = useCallback(
    (changes: any) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: any) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    [],
  )

  return (
    <main style={{ height: '100%', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </main>
  )
}
