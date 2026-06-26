import type { NodeProps } from '@xyflow/react'
import type { NAnswer } from '#/types'
import styles from '../index.module.scss'
import { UNode } from '..'

/**
 * # Answer 节点
 * 在智能体执行的过程中暂停，等待用户输入。
 * 然后根据用户输入，调用调整后续的处理过程。
 * 这个节点在编排中可能触发也可能不触发，完全取决于智能体当时的处理需求。
 */
export const AnswerNode = (props: NodeProps<NAnswer>) => {
  const hasContent = props.data.question || props.data.reply

  return (
    <UNode node={props}>
      {hasContent && (
        <div className={styles.line}>
          {props.data.question && (
            <div className={styles.row}>
              <span className={styles.row_weak}>{props.data.question}</span>
            </div>
          )}
          {props.data.options && props.data.options.length > 0 && (
            <div className={styles.row}>
              <span>{props.data.options.join(' / ')}</span>
            </div>
          )}
          {props.data.reply && (
            <div className={styles.row}>
              <span>{props.data.reply}</span>
            </div>
          )}
        </div>
      )}
    </UNode>
  )
}
