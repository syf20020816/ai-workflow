import type { NodeProps } from '@xyflow/react'
import type { NSkill } from '#/types'
import { isLocalSkillId } from '#/services/skill'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const SkillNode = (props: NodeProps<NSkill>) => {
  const { data } = props
  return (
    <UNode node={props}>
      {data.skillName && (
        <Tag color="purple">
          {isLocalSkillId(data.skillId || '') ? `(个人) ${data.skillName}` : data.skillName}
        </Tag>
      )}
    </UNode>
  )
}
