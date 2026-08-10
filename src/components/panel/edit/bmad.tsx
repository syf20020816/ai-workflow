import { useNodeStore } from '#/store/node'
import { useBmadAgentStore } from '#/store/bmad'
import type { NBMadAgent, NBMadAgentData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography, Select } from 'antd'
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
  const agents = useBmadAgentStore((state) => state.agents)
  const fetchAgents = useBmadAgentStore((state) => state.fetchAgents)

  useEffect(() => {
    if (agents.length === 0) fetchAgents()
  }, [agents.length, fetchAgents])

  const rows: DynEditKVRow[] = [
    {
      key: 'role',
      label: '角色名称',
      valueRender: (onChange) => (
        <Select
          style={{ width: '100%' }}
          placeholder="选择 BMad 角色"
          allowClear
          value={currentNode.data.role || undefined}
          options={agents.map((a) => ({
            label: `${a.title} (${a.name})`,
            value: a.title,
          }))}
          onChange={(val) => {
            onChange(val)
            if (val) {
              const agent = agents.find((a) => a.title === val)
              if (agent?.description) {
                patchCurrentNode((draft) => {
                  const data = d(draft)
                  data.roleDescription = agent.description
                })
              }
            }
          }}
        />
      ),
    },
    {
      key: 'roleDescription',
      label: '角色指令',
      value: currentNode.data.roleDescription,
      inputType: 'textArea',
      rows: 5,
      placeholder: '描述该角色的职责 Skill，内容将作为系统提示词注入智能体节点',
    },
    {
      key: 'systemPrompt',
      label: '补充提示词',
      value: currentNode.data.systemPrompt,
      inputType: 'textArea',
      rows: 4,
      placeholder: '可选，会追加到 roleDescription 之后',
    },
  ]

  return (
    <div>
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'role') data.role = (value || '') as string
            else if (key === 'roleDescription')
              data.roleDescription = (value || '') as string
            else if (key === 'systemPrompt')
              data.systemPrompt = (value || '') as string
          })
        }}
      />
      <div
        style={{
          fontSize: 11,
          color: '#888',
          marginTop: 12,
          padding: '8px 12px',
          background: 'var(--xy-node-selected)',
          borderRadius: 4,
        }}
      >
        <Text type="secondary">
          BMad 节点不会调用
          AI，而是将角色指令通过「系统提示词」注入下游的智能体节点。
          请在下游的智能体节点中选择模型。
        </Text>
      </div>
    </div>
  )
}
