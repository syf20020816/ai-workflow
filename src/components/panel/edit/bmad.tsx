import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
import { useRouteStore } from '#/store/route'
import type { NBMadAgent, NBMadAgentData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Select, Button, Space, Typography } from 'antd'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'
import { useEffect } from 'react'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NBMadAgentData

export const EditBMADAgent = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NBMadAgent>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const models = useModelStore((state) => state.models)
  const fetchModels = useModelStore((state) => state.fetchModels)
  const switchTo = useRouteStore((state) => state.switchTo)

  useEffect(() => {
    fetchModels()
  }, [])

  const selectedModelId = currentNode.data.modal?.name || undefined

  const rows: DynEditKVRow[] = [
    {
      key: 'role',
      label: '智能体角色',
      value: currentNode.data.role,
      placeholder: '如：需求分析师、架构师、Scrum Master',
    },
    {
      key: 'roleDescription',
      label: '角色描述',
      value: currentNode.data.roleDescription,
      inputType: 'textArea',
      rows: 3,
      placeholder: '描述该角色的职责和关注点',
    },
    {
      key: 'model',
      label: '选择模型',
      valueRender: (onChange) => (
        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ flex: 1 }}
            placeholder="选择模型..."
            value={selectedModelId}
            notFoundContent="暂无模型，请先添加"
            options={models.map((m) => ({
              label: `${m.name} (${m.modelName})`,
              value: m.name,
            }))}
            onChange={(value) => {
              const model = models.find((m) => m.name === value)
              if (!model) return
              patchCurrentNode((draft) => {
                const data = d(draft)
                data.modal ??= {}
                data.modal.name = model.modelName
                data.modal.key = model.apiKey
                data.modal.url = model.url
                data.modal.token = model.token
                  ? { min: model.token.min, max: model.token.max }
                  : undefined
              })
              onChange(value)
            }}
          />
          <Button onClick={() => switchTo('model')}>管理</Button>
        </Space.Compact>
      ),
      actionRender: null,
    },
    {
      key: 'temperature',
      label: '温度参数',
      value: currentNode.data.temperature,
      inputType: 'number',
      min: 0,
      max: 2,
      step: 0.1,
      placeholder: '0.0 ~ 2.0',
    },
    {
      key: 'systemPrompt',
      label: '系统提示词',
      value: currentNode.data.systemPrompt,
      inputType: 'textArea',
      rows: 4,
      placeholder: '设置系统级提示词，指导智能体行为',
    },
  ]

  return (
    <>
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'role') data.role = (value || '') as string
            else if (key === 'roleDescription') data.roleDescription = (value || '') as string
            else if (key === 'temperature') data.temperature = value as number
            else if (key === 'systemPrompt') data.systemPrompt = (value || '') as string
            // model 已在 valueRender 中处理
          })
        }}
      />

      {/* 当前使用模型的信息展示 */}
      {selectedModelId && (
        <div style={{ fontSize: 11, color: 'var(--xy-edge-stroke-default)', marginTop: 4 }}>
          <Text type="secondary">
            API URL: {currentNode.data.modal?.url || '未配置'}
          </Text>
        </div>
      )}
    </>
  )
}
