import type { NodeProps } from '@xyflow/react'
import type { NKeywordAgent } from '#/types'
import styles from '../index.module.scss'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const KeywordAgentNode = (props: NodeProps<NKeywordAgent>) => {
  const { data } = props

  return (
    <UNode node={props}>
      {data.modal?.name && (
        <div className={styles.row}>
          <Tag color="blue">{data.modal.name}</Tag>
        </div>
      )}
      {data.keywords && data.keywords.length > 0 && (
        <div className={styles.row}>
          <Tag color="green">{data.keywords.length} 个关键词</Tag>
        </div>
      )}
    </UNode>
  )
}
