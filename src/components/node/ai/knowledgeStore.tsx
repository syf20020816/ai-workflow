import type { NodeProps } from '@xyflow/react'
import type { NKnowledgeStore } from '#/types'
import { UNode } from '..'
import { Tag } from 'antd'

export const KnowledgeStoreNode = (props: NodeProps<NKnowledgeStore>) => {
  const { data } = props
  const collectionName = data.collectionName || ''

  return (
    <UNode node={props}>
      {collectionName && (
        <Tag color="green" style={{ marginTop: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {collectionName}
        </Tag>
      )}
    </UNode>
  )
}
