import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
import { useBmadAgentStore } from '#/store/bmad'
import { useRouteStore } from '#/store/route'
import { NodeTypes } from '#/types'
import type { NAgent, NAgentData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Select, Button, Typography, Tooltip } from 'antd'
import { DisconnectOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'
import { useEffect } from 'react'
import { EditButton } from '#/components/button'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NAgentData

export const EditAgent = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAgent>
  const nodes = useNodeStore((state) => state.nodes)
  const edges = useNodeStore((state) => state.edges)
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)
  const addBmadAgentForCurrent = useNodeStore(
    (state) => state.addBmadAgentForCurrent,
  )
  const removeConnectedBmad = useNodeStore((state) => state.removeConnectedBmad)

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

  // 查找当前 AgentNode 是否已有连线 BMadNode
  const connectedBmadEdge = edges.find(
    (e) =>
      e.source === currentNode.id &&
      nodes.find((n) => n.id === e.target)?.type === NodeTypes.BMAD_AGENT,
  )
  const connectedBmadNode = connectedBmadEdge
    ? nodes.find((n) => n.id === connectedBmadEdge.target)
    : null
  const connectedBmadData = connectedBmadNode?.data as any
  const connectedAgentId = connectedBmadData?.agentId || undefined
  const hasBmadConnection = !!connectedBmadNode

  const rows: DynEditKVRow[] = [
    {
      key: 'alias',
      label: '智能体别名',
      value: currentNode.data.modal?.alias,
      placeholder: '给智能体取一个易记的别名',
    },
    {
      key: 'model',
      label: '选择模型',
      valueRender: (onChange) => (
        <Select
          style={{ width: '100%' }}
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
              data.modal.id = model.id
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
      ),
      actionRender: <EditButton.To url={'prompts'} />,
    },
    {
      key: 'agent',
      label: '选择角色 (BMad)',
      valueRender: (onChange) => (
        <Select
          style={{ width: '100%' }}
          placeholder={
            hasBmadConnection ? '已连接角色（可换选）' : '选择角色...'
          }
          value={connectedAgentId}
          notFoundContent="暂无角色，请先添加"
          options={agents.map((a) => ({
            label: `${a.title} (${a.name})`,
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

            // 自动创建或更新 BMadAgentNode
            addBmadAgentForCurrent({
              title: agent.title || agent.name,
              name: agent.name,
              description: agent.description,
            })
            onChange(agentId)
          }}
        />
      ),
      actionRender: (
        <Button size="small" onClick={() => switchTo('prompts')}>
          管理
        </Button>
      ),
    },
  ]

  return (
    <>
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          if (key === 'alias') {
            patchCurrentNode((draft) => {
              const data = d(draft)
              data.modal ??= {}
              data.modal.alias = (value || '') as string
            })
          }
          // model 和 agent 的变更已在 valueRender 中处理
        }}
      />

      {/* 已连接 BMad 角色的状态提示 */}
      {hasBmadConnection && connectedBmadData?.role && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--xy-edge-stroke-default)' }}>
            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              已连接角色: {connectedBmadData.role}
            </Text>
          </div>
          <Tooltip title="断开 BMad 角色连接">
            <Button
              type="text"
              size="small"
              danger
              icon={<DisconnectOutlined />}
              onClick={() => {
                removeConnectedBmad()
              }}
            />
          </Tooltip>
        </div>
      )}

      {/* 当前选择的信息展示 */}
      {selectedModelId && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--xy-edge-stroke-default)',
            marginTop: 4,
          }}
        >
          <Text type="secondary">
            API URL: {currentNode.data.modal?.url || '未配置'}
          </Text>
        </div>
      )}
    </>
  )
}
