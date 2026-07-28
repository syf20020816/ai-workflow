import { useNodeStore } from '#/store/node'
import type { NKnowledgeRetrieval, NKnowledgeRetrievalData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography } from 'antd'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NKnowledgeRetrievalData

export const EditKnowledgeRetrieval = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NKnowledgeRetrieval>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows: DynEditKVRow[] = [
    {
      key: 'collectionName',
      label: '集合名称',
      value: currentNode.data.collectionName,
      placeholder: '如: my-knowledge-base',
    },
    {
      key: 'query',
      label: '查询文本',
      value: currentNode.data.query,
      placeholder: '输入搜索关键词，或从上游节点获取',
      inputType: 'textArea',
      rows: 2,
    },
    {
      key: 'topK',
      label: '返回数量',
      value: currentNode.data.topK,
      placeholder: '5',
      inputType: 'number',
      min: 1,
      max: 50,
    },
    {
      key: 'scoreThreshold',
      label: '最低分数',
      value: currentNode.data.scoreThreshold,
      placeholder: '0',
      inputType: 'number',
      min: 0,
      max: 1,
      step: 0.05,
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          从 Qdrant 向量数据库中进行语义检索，检索结果作为上下文传递给下游节点。需确保 Qdrant 服务已启动且有对应的集合。
        </Text>
      </div>

      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'collectionName') {
              data.collectionName = (value || '') as string
            } else if (key === 'query') {
              data.query = (value || '') as string
            } else if (key === 'topK') {
              data.topK = (value ?? 5) as number
            } else if (key === 'scoreThreshold') {
              data.scoreThreshold = (value ?? 0) as number
            }
          })
        }}
      />
    </>
  )
}
