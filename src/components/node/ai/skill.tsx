import type { NodeProps } from '@xyflow/react'
import type { NSkill } from '#/types'
import { UNode } from '..'
import { Tag } from 'antd'

export const SkillNode = (props: NodeProps<NSkill>) => {
  const { data } = props
  return (
    <UNode node={props}>
      {data.skillName && (
        <Tag color="purple" style={{ marginTop: 4 }}>{data.skillName}</Tag>
      )}
    </UNode>
  )
}
