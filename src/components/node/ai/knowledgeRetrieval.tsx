import type { NodeProps } from '@xyflow/react'
import type { NKnowledgeRetrieval } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const KnowledgeRetrievalNode = (
  props: NodeProps<NKnowledgeRetrieval>,
) => {
  const { data } = props
  const collectionName = data.collectionName || ''
  const topK = data.topK || 5

  return (
    <UNode node={props}>
      {collectionName && (
        <Tag color="cyan">
          {collectionName} (top {topK})
        </Tag>
      )}
    </UNode>
  )
}
