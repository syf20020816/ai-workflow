import type { NodeProps } from '@xyflow/react'
import type { NIfCondition } from '#/types'
import styles from '../index.module.scss'
import { Tag } from 'antd'
import { UNode } from '..'

/**
 * # ifConditionNode：条件分支节点
 * 作为 ifNode 的分支，每个节点代表一个条件路径。
 * 条件表达式写在 condition 中，label 用于区分不同分支。
 */
export const IfConditionNode = (props: NodeProps<NIfCondition>) => {
  const label = props.data.label || props.data.condition

  return (
    <UNode node={props}>
      <div className={styles.row}>
        <Tag color="orange" style={{ fontSize: 9, margin: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label || '条件分支'}
        </Tag>
      </div>
    </UNode>
  )
}
