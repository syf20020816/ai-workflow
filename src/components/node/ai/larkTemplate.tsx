import type { NodeProps } from '@xyflow/react'
import type { NLarkTemplate } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const LarkTemplateNode = (props: NodeProps<NLarkTemplate>) => {
  const { data } = props
  return (
    <UNode node={props}>
      {data.templateUrl && (
        <Tag color="blue">
          {data.templateUrl}
        </Tag>
      )}
    </UNode>
  )
}
