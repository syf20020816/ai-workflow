import { useNodeStore } from '#/store/node'
import type { NIfCondition, NIfConditionData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NIfConditionData

export const EditIfCondition = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NIfCondition>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows: DynEditKVRow[] = [
    {
      key: 'label',
      label: '分支标签',
      value: currentNode.data.label,
      placeholder: '如「条件A」、「成功路径」',
    },
    {
      key: 'condition',
      label: '条件表达式',
      value: currentNode.data.condition,
      inputType: 'textArea',
      rows: 2,
      placeholder: '描述该分支的判断条件',
    },
  ]

  return (
    <DynEditKV
      rows={rows}
      onChange={(key, value) => {
        patchCurrentNode((draft) => {
          const data = d(draft)
          if (key === 'label') data.label = (value || '') as string
          if (key === 'condition') data.condition = (value || '') as string
        })
      }}
    />
  )
}
