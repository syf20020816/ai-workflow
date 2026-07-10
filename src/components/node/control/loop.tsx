import type { NodeProps } from '@xyflow/react'
import type { NLoop } from '#/types'
import styles from '../index.module.scss'
import { Tag } from 'antd'
import { UNode } from '..'

/**
 * # loopNode：循环节点
 * 需要循环时必须使用 loopNode。节点最终会连到 loopConditionNode，
 * loopConditionNode 负责判断是否退出循环。
 * loopNode 内置最大循环次数，默认 5 次。
 */
export const LoopNode = (props: NodeProps<NLoop>) => {
  return (
    <UNode node={props}>
      <div className={styles.row}>
        <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>
          最大 {props.data.maxLoopCount} 次
        </Tag>
      </div>
      {props.data.condition && (
        <div className={styles.row}>
          <span style={{ fontSize: 9, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {props.data.condition}
          </span>
        </div>
      )}
    </UNode>
  )
}
