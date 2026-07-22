import type { NodeProps } from '@xyflow/react'
import type { NLarkTemplate } from '#/types'
import { UNode } from '..'
import { Tag } from 'antd'

export const LarkTemplateNode = (props: NodeProps<NLarkTemplate>) => {
  const { data } = props
  return (
    <UNode node={props}>
      {data.templateUrl && (
        <Tag color="blue" style={{ marginTop: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.templateUrl.slice(0, 40)}...
        </Tag>
      )}
    </UNode>
  )
}
