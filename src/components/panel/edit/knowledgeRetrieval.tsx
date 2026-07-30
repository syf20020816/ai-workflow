import { useEffect, useState } from 'react'
import { useNodeStore } from '#/store/node'
import type { NKnowledgeRetrieval, NKnowledgeRetrievalData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography, Select, Space, Button, Input, Tooltip, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined, FilterOutlined } from '@ant-design/icons'
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

  const [collections, setCollections] = useState<string[]>([])
  const [loadingCollections, setLoadingCollections] = useState(false)

  // 加载集合列表
  useEffect(() => {
    const load = async () => {
      setLoadingCollections(true)
      try {
        const res = await fetch('/api/execute/qdrant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'collections' }),
        })
        const data = await res.json()
        if (data.status === 'success') {
          const names: string[] = data.output?.collections?.map((c: any) => c.name) || []
          setCollections(names)
        }
      } catch { /* 静默 */ }
      setLoadingCollections(false)
    }
    load()
  }, [])

  // 当前选中的集合列表
  const selectedNames = currentNode.data.collectionNames?.length
    ? currentNode.data.collectionNames
    : currentNode.data.collectionName
      ? [currentNode.data.collectionName]
      : []

  // 筛选条件
  const filters = currentNode.data.filters || []

  const rows: DynEditKVRow[] = [
    {
      key: 'collectionNames',
      label: '目标集合',
      valueRender: (onChange) => (
        <Select
          mode="multiple"
          placeholder="选择一个或多个集合"
          loading={loadingCollections}
          value={selectedNames}
          onChange={(vals) => onChange(vals)}
          options={collections.map((c) => ({ value: c, label: c }))}
          showSearch
          style={{ width: '100%' }}
          tagRender={(props) => {
            const { label, closable, onClose } = props
            return (
              <Tag closable={closable} onClose={onClose} style={{ marginInlineEnd: 4 }}>
                {label}
              </Tag>
            )
          }}
        />
      ),
    },
    {
      key: 'query',
      label: '查询文本',
      value: currentNode.data.query,
      placeholder: '输入搜索关键词，或留空从上游节点获取',
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
          从 Qdrant 向量数据库中进行语义检索，支持跨多个集合联合搜索。检索结果作为上下文传递给下游节点。
        </Text>
      </div>

      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'collectionNames') {
              data.collectionNames = (value || []) as string[]
              // 同步兼容旧字段
              if (data.collectionNames.length === 1) {
                data.collectionName = data.collectionNames[0]
              } else {
                data.collectionName = undefined
              }
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

      {/* ===== 筛选条件区域 ===== */}
      <div style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <FilterOutlined style={{ color: '#888' }} />
          <Text strong style={{ fontSize: 13 }}>
            筛选条件
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            按 payload 字段精确匹配（可选）
          </Text>
        </Space>
        {filters.map((f, i) => (
          <Space key={i} style={{ display: 'flex', marginBottom: 6 }} align="center">
            <Input
              size="small"
              placeholder="字段名"
              style={{ width: 130 }}
              value={f.field}
              onChange={(e) => {
                const newFilters = [...filters]
                newFilters[i] = { ...newFilters[i], field: e.target.value }
                patchCurrentNode((draft) => {
                  d(draft).filters = newFilters
                })
              }}
            />
            <Text type="secondary">=</Text>
            <Input
              size="small"
              placeholder="匹配值"
              style={{ width: 150 }}
              value={f.match}
              onChange={(e) => {
                const newFilters = [...filters]
                newFilters[i] = { ...newFilters[i], match: e.target.value }
                patchCurrentNode((draft) => {
                  d(draft).filters = newFilters
                })
              }}
            />
            <Tooltip title="删除">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  const newFilters = filters.filter((_, j) => j !== i)
                  patchCurrentNode((draft) => {
                    d(draft).filters = newFilters
                  })
                }}
              />
            </Tooltip>
          </Space>
        ))}
        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => {
            const newFilters = [...filters, { field: '', match: '' }]
            patchCurrentNode((draft) => {
              d(draft).filters = newFilters
            })
          }}
        >
          添加条件
        </Button>
      </div>
    </>
  )
}
