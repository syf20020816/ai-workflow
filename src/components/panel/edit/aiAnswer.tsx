import { useNodeStore } from '#/store/node'
import type { NAnswer, NAnswerData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NAnswerData

export const EditAnswer = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAnswer>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows: DynEditKVRow[] = [
    {
      key: 'question',
      label: '向用户提出的问题',
      value: currentNode.data.question,
      inputType: 'textArea',
      rows: 3,
      placeholder: '输入需要用户回答的问题',
    },
    {
      key: 'options',
      label: '预置选项（逗号分隔）',
      value: currentNode.data.options?.join(','),
      placeholder: '选项1,选项2,选项3',
    },
  ]

  return (
    <DynEditKV
      rows={rows}
      onChange={(key, value) => {
        patchCurrentNode((draft) => {
          const data = d(draft)
          if (key === 'question') {
            data.question = (value || '') as string
          } else if (key === 'options') {
            data.options = (value || '')
              .toString()
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          }
        })
      }}
    />
  )
}
