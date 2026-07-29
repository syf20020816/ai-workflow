import { useNodeStore } from '#/store/node'
import type { NKnowledgeStore, NKnowledgeStoreData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Select, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NKnowledgeStoreData

export const EditKnowledgeStore = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NKnowledgeStore>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const [collections, setCollections] = useState<string[]>([])
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [colRes, modelRes] = await Promise.all([
          fetch('/api/execute/qdrant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'collections' }),
          }),
          fetch('/api/execute/models'),
        ])
        const colData = await colRes.json()
        const modelData = await modelRes.json()
        if (colData.status === 'success') {
          setCollections(
            colData.output?.collections?.map((c: any) => c.name) || [],
          )
        }
        if (modelData.status === 'success') {
          setModels(modelData.output?.models || [])
        }
      } catch (err: any) {
        message.error(`加载数据失败: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const rows: DynEditKVRow[] = [
    {
      key: 'collectionName',
      label: '目标集合',
      value: currentNode.data.collectionName || '',
      valueRender: (onChange) => (
        <Select
          placeholder="选择 Qdrant 集合"
          loading={loading}
          value={currentNode.data.collectionName || undefined}
          onChange={(val) => onChange(val)}
          options={collections.map((c) => ({ value: c, label: c }))}
          showSearch
          style={{ width: '100%' }}
        />
      ),
    },
    {
      key: 'modelId',
      label: 'Embedding 模型',
      value: currentNode.data.modelId || '',
      valueRender: (onChange) => (
        <Select
          placeholder="自动选择（推荐）"
          loading={loading}
          allowClear
          value={currentNode.data.modelId || undefined}
          onChange={(val) => onChange(val)}
          options={models.map((m) => ({ value: m.id, label: m.name }))}
          showSearch
          style={{ width: '100%' }}
        />
      ),
    },
    {
      key: 'chunkSize',
      label: '分块大小',
      value: currentNode.data.chunkSize ?? 800,
      inputType: 'number',
      min: 100,
      max: 4000,
    },
    {
      key: 'chunkOverlap',
      label: '分块重叠',
      value: currentNode.data.chunkOverlap ?? 100,
      inputType: 'number',
      min: 0,
      max: 1000,
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          将上游节点输出的文本内容自动分块、向量化后写入 Qdrant
          知识库。通常上游接飞书文档或代码读取节点。
        </Text>
      </div>

      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'collectionName') {
              data.collectionName = (value || '') as string
            } else if (key === 'modelId') {
              data.modelId = (value || '') as string
            } else if (key === 'chunkSize') {
              data.chunkSize = (value ?? 800) as number
            } else if (key === 'chunkOverlap') {
              data.chunkOverlap = (value ?? 100) as number
            }
          })
        }}
      />
    </>
  )
}
