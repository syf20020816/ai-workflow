import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
import { useBmadAgentStore } from '#/store/bmad'
import { useRouteStore } from '#/store/route'
import type { NAgent, NAgentData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Select, Button, Space, Typography } from 'antd'
import { EditItem } from './item'
import { useEffect } from 'react'

const { Text } = Typography

const d = (draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>) =>
  draft.data as NAgentData

export const EditAgent = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAgent>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)
  const addBmadAgentForCurrent = useNodeStore((state) => state.addBmadAgentForCurrent)

  const models = useModelStore((state) => state.models)
  const fetchModels = useModelStore((state) => state.fetchModels)
  const agents = useBmadAgentStore((state) => state.agents)
  const fetchAgents = useBmadAgentStore((state) => state.fetchAgents)
  const switchTo = useRouteStore((state) => state.switchTo)

  useEffect(() => {
    fetchModels()
    fetchAgents()
  }, [])

  const selectedModelId = currentNode.data.modal?.name || undefined
  const selectedRole = currentNode.data.modal?.alias || undefined

  return (
    <>
      <EditItem
        label="智能体别名"
        placeholder="给智能体取一个易记的别名"
        value={currentNode.data.modal?.alias}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            data.modal ??= {}
            data.modal.alias = (v || '') as string
          })
        }}
      />

      {/* 模型选择 */}
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

      {/* 角色选择 */}
      <div className="line">
        <Text>选择角色 (BMad)</Text>
        <Space.Compact style={{ width: '100%' }}>
          <Select
            style={{ flex: 1 }}
            placeholder="选择角色..."
            value={selectedRole}
            notFoundContent="暂无角色，请先添加"
            options={agents.map((a) => ({
              label: `${a.icon || '🤖'} ${a.title} (${a.name})`,
              value: a.id,
            }))}
            onChange={(agentId) => {
              const agent = agents.find((a) => a.id === agentId)
              if (!agent) return

              // 更新当前 AgentNode 的别名
              patchCurrentNode((draft) => {
                const data = d(draft)
                data.modal ??= {}
                data.modal.alias = agent.title
              })

              // 自动创建 BMadAgentNode 并连接
              addBmadAgentForCurrent({
                title: agent.title || agent.name,
                name: agent.name,
                description: agent.description,
              })
            }}
          />
          <Button onClick={() => switchTo('skill')}>管理</Button>
        </Space.Compact>
      </div>

      {/* 当前选择的信息展示 */}
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
