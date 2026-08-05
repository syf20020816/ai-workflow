import type { NodeProps } from '@xyflow/react'
import type { NTaskPlanner } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

export const TaskPlannerNode = (props: NodeProps<NTaskPlanner>) => {
  const { data } = props
  return (
    <UNode node={props}>
      {data.batchCount != null && (
        <Tag color="cyan">{data.batchCount} Batch</Tag>
      )}
      {data.taskCount != null && <Tag color="blue">{data.taskCount} Tasks</Tag>}
    </UNode>
  )
}
