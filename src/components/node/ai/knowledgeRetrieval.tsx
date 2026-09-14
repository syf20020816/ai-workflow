import type { NodeProps } from '@xyflow/react'
import type { NKnowledgeRetrieval } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const KnowledgeRetrievalNode = (
  props: NodeProps<NKnowledgeRetrieval>,
) => {
  const { data } = props
  const mode = data.mode || 'local'

  return (
    <UNode node={props}>
      {mode === 'api' ? (
        data.url && (
          <Tag color="cyan">
            {data.method || 'GET'} {data.url}
          </Tag>
        )
      ) : (
        <>
          {data.skillName && <Tag color="purple">技能: {data.skillName}</Tag>}
          {data.tool && <Tag color="blue">本地: {data.tool}</Tag>}
        </>
      )}
    </UNode>
  )
}
