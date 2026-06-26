import { useNodeStore } from '#/store/node'
import type { NAnswer, NAnswerData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NAnswerData

export const EditAnswer = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAnswer>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  return (
    <>
      <EditItem
        label="向用户提出的问题"
        placeholder="输入需要用户回答的问题"
        inputType="textArea"
        rows={3}
        value={currentNode.data.question}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).question = (v || '') as string
          })
        }}
      />
      <EditItem
        label="预置选项（逗号分隔）"
        placeholder="选项1,选项2,选项3"
        value={currentNode.data.options?.join(',')}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).options = (v || '')
              .toString()
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          })
        }}
      />
    </>
  )
}
