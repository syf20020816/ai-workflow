import type { NodeProps } from '@xyflow/react'
import type { NRetry } from '#/types'
import styles from '../index.module.scss'
import { Tag } from '#/components/tag'
import { UNode } from '..'

/**
 * # retryNode：错误重试节点
 * 表示执行错误后重试。支持人工判断（关键词匹配）和 AI 判断。
 * 默认 1s 后重试，最大重试次数为 5。
 */
export const RetryNode = (props: NodeProps<NRetry>) => {
  const modeLabel = props.data.judgmentMode === 'ai' ? 'AI判断' : '关键词匹配'
  const modeColor = props.data.judgmentMode === 'ai' ? 'purple' : 'orange'

  return (
    <UNode node={props}>
      <div className={styles.row}>
        <Tag color={modeColor}>
          {modeLabel}
        </Tag>
        <span style={{ fontSize: 9 }}>
          {props.data.retryDelay}s / {props.data.maxRetryCount}次
        </span>
      </div>
    </UNode>
  )
}
