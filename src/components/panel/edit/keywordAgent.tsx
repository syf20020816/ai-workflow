import { useEffect, useState, useRef } from 'react'
import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
import type { NKeywordAgent, NKeywordAgentData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography, Select, Divider } from 'antd'
import { DynEditKV } from './item'
import { CodeEditor } from '#/components/file-editor/editor'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NKeywordAgentData

export const EditKeywordAgent = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NKeywordAgent>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const models = useModelStore((state) => state.models)
  const fetchModels = useModelStore((state) => state.fetchModels)

  const selectedModelId = currentNode.data.modal?.name || undefined
  const formatValue = currentNode.data.format || '{\n  "keywords": string[]\n}'
  const [promptContent, setPromptContent] = useState('')

  // 本地 CodeEditor state（避免失焦问题）
  const [localFormat, setLocalFormat] = useState(formatValue)
  const formatRef = useRef(formatValue)
  formatRef.current = formatValue

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  // 加载 prompt 文件
  useEffect(() => {
    fetch('/api/prompts?name=keywordAgent.md')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success') {
          setPromptContent(data.data.content)
        } else {
          setPromptContent('// 提示文件加载失败')
        }
      })
      .catch(() => {
        setPromptContent('// 提示文件加载失败')
      })
  }, [])

  // 同步外部 format 到本地
  useEffect(() => {
    setLocalFormat(formatValue)
  }, [formatValue])

  const rows = [
    {
      key: 'model',
      label: 'AI 模型',
      valueRender: (onChange: (v: any) => void) => (
        <Select
          style={{ flex: 1, width: '100%' }}
          // size="small"
          placeholder="选择模型"
          value={selectedModelId}
          notFoundContent="暂无模型，请先在「规则与模型」中添加"
          options={models.map((m) => ({
            label: `${m.name} (${m.modelName})`,
            value: m.name,
          }))}
          onChange={(modelName) => {
            const model = models.find((m) => m.name === modelName)
            if (model) {
              onChange({
                id: model.id,
                name: model.modelName,
                key: model.apiKey || '',
                url: model.url || '',
                token: model.token || { min: 100, max: 4096 },
                alias: model.name,
              })
            } else {
              onChange(undefined)
            }
          }}
          allowClear
          onClear={() => onChange(undefined)}
        />
      ),
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          调用 AI 从上游内容中提取关键词列表，输出格式可由下方编辑器自定义
        </Text>
      </div>

      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'model') {
              data.modal = value || undefined
            }
          })
        }}
      />

      {/* 输出格式编辑区 */}
      <Divider style={{ margin: '12px 0', fontSize: 12 }}>
        输出格式 (JSON)
      </Divider>
      <div style={{ marginBottom: 6, padding: '0 4px' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          AI 将按此 JSON 模板格式输出关键词，需包含 keywords 数组字段
        </Text>
      </div>
      <div
        style={{
          border: '1px solid #333',
          borderRadius: 4,
          overflow: 'hidden',
          maxHeight: 200,
        }}
      >
        <CodeEditor
          value={localFormat}
          onChange={(v) => {
            setLocalFormat(v)
          }}
          maxHeight={160}
          language="json"
        />
      </div>
      <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 10 }}>
          按 ⌘S / Ctrl+S 保存格式
        </Text>
      </div>

      {/* 系统提示词预览 */}
      <Divider style={{ margin: '12px 0', fontSize: 12 }}>系统提示词</Divider>
      {promptContent && (
        <CodeEditor maxHeight={200} value={promptContent} language="markdown" />
      )}
      {!promptContent && (
        <div
          style={{
            padding: '6px 8px',
            background: '#141414',
            borderRadius: 4,
            fontSize: 11,
            color: '#555',
          }}
        >
          正在从 prompts/keywordAgent.md 加载...
        </div>
      )}
    </>
  )
}
