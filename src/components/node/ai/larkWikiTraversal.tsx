import type { NodeProps } from '@xyflow/react'
import type { NLarkWikiTraversal } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const LarkWikiTraversalNode = (props: NodeProps<NLarkWikiTraversal>) => {
  const { data } = props
  const display = data.spaceUrl || data.spaceName || data.spaceId || ''
  const docCount = data.result?.totalDocs

  return (
    <UNode node={props}>
      {display && <Tag color="blue">{display}</Tag>}
      {docCount !== undefined && (
        <Tag color="green">{docCount} 个文档</Tag>
      )}
    </UNode>
  )
}
