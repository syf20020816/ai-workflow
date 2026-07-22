import { useNodeStore } from '#/store/node'
import type { NLarkTemplate, NLarkTemplateData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NLarkTemplateData

export const EditLarkTemplate = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NLarkTemplate>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows: DynEditKVRow[] = [
    {
      key: 'templateUrl',
      label: 'Lark文档 URL',
      value: currentNode.data.templateUrl,
      placeholder: 'https://xxx.feishu.cn/docx/xxx',
    },
  ]

  return (
    <DynEditKV
      rows={rows}
      onChange={(key, value) => {
        patchCurrentNode((draft) => {
          const data = d(draft)
          if (key === 'templateUrl') {
            data.templateUrl = (value || '') as string
          }
        })
      }}
    />
  )
}
