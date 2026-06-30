import type { NodeProps } from '@xyflow/react'
import type { NBMadAgent } from '#/types'
import styles from '../../index.module.scss'
import { Tag } from 'antd'
import { UNode } from '../..'

/**
 * # BMad 角色节点
 * 作为 AgentNode 的子节点存在。
 * 当在 AgentNode 编辑面板中选择 BMad 角色时自动创建。
 * 展示角色名称、描述、图标等 BMad config 中定义的信息。
 */
export const BmadAgentNode = (props: NodeProps<NBMadAgent>) => {
  const hasContent = props.data.role || props.data.roleDescription

  return (
    <UNode node={props}>
      {hasContent && (
        <div className={styles.line}>
          <div className={styles.row}>
            <Tag color="purple" bordered={false}>
              {props.data.role || '未知角色'}
            </Tag>
          </div>
          {props.data.roleDescription && (
            <div className={styles.row}>
              <span className={styles.row_weak}>
                {props.data.roleDescription.length > 80
                  ? props.data.roleDescription.slice(0, 80) + '...'
                  : props.data.roleDescription}
              </span>
            </div>
          )}
        </div>
      )}
    </UNode>
  )
}
