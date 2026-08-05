import { Handle, Position } from '@xyflow/react'
import type { AppNode } from '#/types'
import styles from './index.module.scss'
import { useNodeStore } from '#/store/node'
import type { ReactNode } from 'react'
import { AddNodeBtn } from './edge/add'
import { NodeHeader } from './header'
import { RunNode } from './edge/run'
import { PinNode } from './edge/pin-node'
import type { NodeStatus } from '#/types/engine'
import { Badge } from 'antd'
import { StepMarkNode } from './edge/step'
import { useGlobalStore } from '#/store/global'

export interface UNodeProps {
  node: Exclude<AppNode, null>
  children: ReactNode
}

const statusBadgeMap: Record<
  NodeStatus,
  'processing' | 'success' | 'error' | 'default'
> = {
  idle: 'default',
  running: 'processing',
  success: 'success',
  error: 'error',
  waiting: 'processing',
}

export const UNode = ({ node, children }: UNodeProps) => {
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)
  const mode = useGlobalStore((state) => state.globalMode)
  const currentNode = useNodeStore((state) => state.currentNode)
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const kind = node.type
  const isChoose = currentNode !== null && currentNode.id === node.id
  const nodeStatus = pipelineContext.nodeStatuses[node.id] ?? 'idle'

  return (
    <div
      className={`${styles.node} ${isChoose ? styles.node_choose : ''} ${nodeStatus === 'running' ? styles.node_running : ''} ${nodeStatus === 'error' ? styles.node_error : ''}`}
      onClick={() => {
        setCurrentNode(node)
      }}
    >
      <Handle type="target" position={Position.Left} />
      {mode === 'spec' && node.data.specStep && (
        <div className={styles.node_step}>{node.data.specStep}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <NodeHeader kind={kind} title={node.data.title || ''} />
        <Badge status={statusBadgeMap[nodeStatus]} size="small" />
      </div>
      <div className={styles.node_content}>{children}</div>
      <div className={styles.node_tools}>
        <RunNode nodeId={node.id} />
        <StepMarkNode node={node} />
        <PinNode
          nodeId={node.id}
          nodeType={node.type}
          title={node.data.title || ''}
        />
        <AddNodeBtn kind={kind} />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
