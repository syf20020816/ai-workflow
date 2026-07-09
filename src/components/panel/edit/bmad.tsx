import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
import { useRouteStore } from '#/store/route'
import type { NBMadAgent, NBMadAgentData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Select, Button, Space, Typography } from 'antd'
import { EditItem } from './item'
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

  return (
    <>
      <EditItem
        label="智能体角色"
        placeholder="如：需求分析师、架构师、Scrum Master"
        value={currentNode.data.role}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).role = (v || '') as string
          })
        }}
      />
      <EditItem
        label="角色描述"
        placeholder="描述该角色的职责和关注点"
        inputType="textArea"
        rows={3}
        value={currentNode.data.roleDescription}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).roleDescription = (v || '') as string
          })
        }}
      />

      {/* 模型选择（与 AgentNode 一致的 Select 组件） */}
      <div className="line">
        <Text>选择模型</Text>
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
            }}
          />
          <Button onClick={() => switchTo('model')}>管理</Button>
        </Space.Compact>
      </div>

      {/* 当前使用模型的信息展示 */}
      {selectedModelId && (
        <div style={{ fontSize: 11, color: 'var(--xy-edge-stroke-default)', marginTop: 4 }}>
          <Text type="secondary">
            API URL: {currentNode.data.modal?.url || '未配置'}
          </Text>
        </div>
      )}

      <EditItem
        label="温度参数"
        placeholder="0.0 ~ 2.0"
        inputType="number"
        min={0}
        max={2}
        step={0.1}
        value={currentNode.data.temperature}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).temperature = v as number
          })
        }}
      />
      <EditItem
        label="系统提示词"
        placeholder="设置系统级提示词，指导智能体行为"
        inputType="textArea"
        rows={4}
        value={currentNode.data.systemPrompt}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).systemPrompt = (v || '') as string
          })
        }}
      />
    </>
  )
}
