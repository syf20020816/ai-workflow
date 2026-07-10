import { useNodeStore } from '#/store/node'
import type { NIfCondition, NIfConditionData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NIfConditionData

export const EditIfCondition = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NIfCondition>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  return (
    <>
      <EditItem
        label="分支标签"
        placeholder="如「条件A」、「成功路径」"
        value={currentNode.data.label}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).label = (v || '') as string
          })
        }}
      />
      <EditItem
        label="条件表达式"
        placeholder="描述该分支的判断条件"
        inputType="textArea"
        rows={2}
        value={currentNode.data.condition}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).condition = (v || '') as string
          })
        }}
      />
    </>
  )
}
