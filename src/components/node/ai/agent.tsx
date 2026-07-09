import type { NodeProps } from '@xyflow/react'
import type { NAgent } from '#/types'
import { NodeTypes } from '#/types'
import styles from '../index.module.scss'
import { Badge, Tag } from 'antd'
import { UNode } from '../'
import { useNodeStore } from '#/store/node'
import { useBmadAgentStore } from '#/store/bmad'

/**
 * # 智能体节点
 * 接收输入数据，配置智能体参数。
 * 如果连接了 BMad 角色节点，会在节点上显示角色标签。
 */
export const AgentNode = (props: NodeProps<NAgent>) => {
  const edges = useNodeStore((state) => state.edges)
  const nodes = useNodeStore((state) => state.nodes)
  const agents = useBmadAgentStore((state) => state.agents)

  // 查找是否有关联的 BMadNode
  const connectedBmadEdge = edges.find(
    (e) =>
      e.source === props.id &&
      nodes.find((n) => n.id === e.target)?.type === NodeTypes.BMAD_AGENT,
  )
  const connectedBmadNode = connectedBmadEdge
    ? nodes.find((n) => n.id === connectedBmadEdge.target)
    : null
  const connectedBmadData = connectedBmadNode?.data as any

  // 查找 BMad agent 配置
  const agentConfig = connectedBmadData?.agentId
    ? agents.find((a) => a.name === connectedBmadData.agentId)
    : null

  return (
    <UNode node={props}>
      {props.data.modal?.alias && (
        <div className={styles.row}>
          <Badge status="processing" size="small" />
          <span>{props.data.modal.alias}</span>
        </div>
      )}

      {/* 已连接 BMad 角色标签 */}
      {connectedBmadData?.role && (
        <div className={styles.row}>
            <Tag color="purple" style={{ fontSize: 8, margin: 0 }}>
              {agentConfig?.icon} {connectedBmadData.role}
            </Tag>
          </div>
      )}
    </UNode>
  )
}
