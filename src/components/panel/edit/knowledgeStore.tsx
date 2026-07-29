import { useNodeStore } from '#/store/node'
import type { NKnowledgeStore, NKnowledgeStoreData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography, Form, Input, Select, message } from 'antd'
import { useEffect, useState } from 'react'

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
          setCollections(colData.output?.collections?.map((c: any) => c.name) || [])
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

  const patch = (key: keyof NKnowledgeStoreData, value: any) => {
    patchCurrentNode((draft) => {
      const data = d(draft)
      ;(data as any)[key] = value
    })
  }

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          将上游节点输出的文本内容自动分块、向量化后写入 Qdrant 知识库。通常上游接飞书文档或代码读取节点。
        </Text>
      </div>

      <Form layout="vertical" size="small">
        <Form.Item label="目标集合" required>
          <Select
            placeholder="选择 Qdrant 集合"
            loading={loading}
            value={currentNode.data.collectionName || undefined}
            onChange={(val) => patch('collectionName', val)}
            options={collections.map((c) => ({ value: c, label: c }))}
            showSearch
          />
        </Form.Item>

        <Form.Item label="Embedding 模型" tooltip="不选则自动选择含 embedding 标识的模型">
          <Select
            placeholder="自动选择（推荐）"
            loading={loading}
            allowClear
            value={currentNode.data.modelId || undefined}
            onChange={(val) => patch('modelId', val)}
            options={models.map((m) => ({ value: m.id, label: m.name }))}
            showSearch
          />
        </Form.Item>

        <Form.Item label="分块大小（字符）">
          <Input
            type="number"
            min={100}
            max={4000}
            value={currentNode.data.chunkSize ?? 800}
            onChange={(e) => patch('chunkSize', parseInt(e.target.value, 10) || 800)}
          />
        </Form.Item>

        <Form.Item label="分块重叠（字符）">
          <Input
            type="number"
            min={0}
            max={1000}
            value={currentNode.data.chunkOverlap ?? 100}
            onChange={(e) => patch('chunkOverlap', parseInt(e.target.value, 10) || 0)}
          />
        </Form.Item>
      </Form>
    </>
  )
}
