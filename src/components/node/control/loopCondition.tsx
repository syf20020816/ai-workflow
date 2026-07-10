import type { NodeProps } from '@xyflow/react'
import type { NLoopCondition } from '#/types'
import styles from '../index.module.scss'
import { Tag } from 'antd'
import { UNode } from '..'

/**
 * # loopConditionNode：循环条件节点
 * 作为 loopNode 的子节点，负责判断是否继续循环或退出。
 * 与 loopConditionNode 连接而出的节点是循环结束后执行的节点。
 */
export const LoopConditionNode = (props: NodeProps<NLoopCondition>) => {
  return (
    <UNode node={props}>
      {props.data.condition ? (
        <div className={styles.row}>
          <Tag color="blue" style={{ fontSize: 9, margin: 0, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {props.data.condition}
          </Tag>
        </div>
      ) : (
        <div className={styles.row}>
          <span style={{ fontSize: 9, color: '#999' }}>循环条件</span>
        </div>
      )}
    </UNode>
  )
}
