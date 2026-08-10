import type { NodeProps } from '@xyflow/react'
import type { NSkill } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const SkillNode = (props: NodeProps<NSkill>) => {
  const { data } = props
  console.error("skill move")
  return (
    <UNode node={props}>
      {data.skillName && <Tag color="purple">{data.skillName}</Tag>}
    </UNode>
  )
}
