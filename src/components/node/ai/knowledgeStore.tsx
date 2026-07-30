import type { NodeProps } from '@xyflow/react'
import type { NKnowledgeStore } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const KnowledgeStoreNode = (props: NodeProps<NKnowledgeStore>) => {
  const { data } = props
  const collectionName = data.collectionName || ''

  return (
    <UNode node={props}>
      {collectionName && <Tag color="green">{collectionName}</Tag>}
    </UNode>
  )
}
