import { Handle, Position } from '@xyflow/react'
import type { AppNode } from '#/types'
import styles from './index.module.scss'
import { useNodeStore } from '#/store/node'
import type { ReactNode } from 'react'
import { AddNodeBtn } from './edge/add'
import { NodeHeader } from './header'
import { RunNode } from './edge/run'

export interface UNodeProps {
  node: Exclude<AppNode, null>
  children: ReactNode
}

export const UNode = ({ node, children }: UNodeProps) => {
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)
  const currentNode = useNodeStore((state) => state.currentNode)
  const kind = node.type
  const isChoose = currentNode ? currentNode.id === node.id : false

  return (
    <div
      className={`${styles.node} ${isChoose ? styles.node_choose : ''}`}
      onClick={() => {
        setCurrentNode(node)
      }}
    >
      <Handle type="target" position={Position.Left} />
      <NodeHeader kind={kind} title={node.data.title || ''} />
      {children}
      <>
        <RunNode />
        <AddNodeBtn kind={kind} />
      </>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
