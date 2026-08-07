import type { NodeProps } from '@xyflow/react'
import type { NSelfCheck } from '#/types'
import { UNode } from '..'
import { Tag } from '#/components/tag'

/** SelfCheck 自检 Agent 节点：显示总体结论与评审视角角色 */
export const SelfCheckNode = (props: NodeProps<NSelfCheck>) => {
  const { data } = props
  const colorMap: Record<string, string> = {
    PASS: 'green',
    CONDITIONAL_PASS: 'orange',
    FAIL: 'red',
  }
  return (
    <UNode node={props}>
      {data.overallResult && (
        <Tag color={colorMap[data.overallResult] || 'default'}>
          {data.overallResult}
        </Tag>
      )}
      {data.role && <Tag color="purple">{data.role}</Tag>}
    </UNode>
  )
}
