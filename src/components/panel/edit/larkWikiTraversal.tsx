import { useNodeStore } from '#/store/node'
import type { NLarkWikiTraversal, NLarkWikiTraversalData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography } from 'antd'
import { DynEditKV } from './item'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NLarkWikiTraversalData

export const EditLarkWikiTraversal = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NLarkWikiTraversal>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows = [
    {
      key: 'spaceUrl',
      label: '知识库链接',
      value: currentNode.data.spaceUrl || '',
      placeholder: '例如: https://xxx.feishu.cn/wiki/wikcnAbCdEf',
      inputType: 'text' as const,
    },
    {
      key: 'maxDocs',
      label: '最大文档数',
      value: currentNode.data.maxDocs ?? 200,
      inputType: 'number' as const,
      min: 1,
      max: 10000,
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          遍历飞书知识库中的所有文档，读取文档内容后传递给下游节点。
          在飞书知识库页面复制链接粘贴到上方即可。需连接「知识库写入节点」完成向量化存储。
        </Text>
      </div>

      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'spaceUrl') {
              data.spaceUrl = (value || '') as string
              data.spaceId = ''
            } else if (key === 'maxDocs') {
              data.maxDocs = (value ?? 200) as number
            }
          })
        }}
      />
    </>
  )
}
