import type { NodeProps } from '@xyflow/react'
import type { NBMadAgent } from '#/types'
import styles from '../../index.module.scss'
import { Badge, Tag } from 'antd'
import { UNode } from '../..'

/**
 * # BMad 子节点
 * 作为 AgentNode 的子节点存在。
 * 利用 BMad 的多角色特性，赋予智能体不同的角色，如助手、专家等。
 * 在这个节点中需配置智能体角色，以便与 Agent 后续对任务的编排。
 */
export const BmadAgentNode = (props: NodeProps<NBMadAgent>) => {
  const hasContent = props.data.role || props.data.model

  return (
    <UNode node={props}>
      {hasContent && (
        <div className={styles.line}>
          {props.data.role && (
            <div className={styles.row}>
              <Badge status="success" size="small" />
              <Tag color="purple" bordered={false}>
                {props.data.role}
              </Tag>
            </div>
          )}
          {props.data.model && (
            <div className={styles.row}>
              <span className={styles.row_weak}>{props.data.model}</span>
            </div>
          )}
          {props.data.roleDescription && (
            <div className={styles.row}>
              <span className={styles.row_weak}>{props.data.roleDescription}</span>
            </div>
          )}
        </div>
      )}
    </UNode>
  )
}
