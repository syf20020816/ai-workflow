import { useNodeStore } from '#/store/node'
import type { NAgent, NAgentData } from '#/types'
import { Typography } from 'antd'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'

const { Text } = Typography

const d = (draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>) =>
  draft.data as NAgentData

export const EditAgent = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAgent>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

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
      <EditItem
        label="模型 ID"
        placeholder="如：claude-3-5-sonnet"
        value={currentNode.data.modal?.name}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            data.modal ??= {}
            data.modal.name = (v || '') as string
          })
        }}
      />
      <EditItem
        label="API Key"
        placeholder="输入 API 密钥"
        inputType="password"
        value={currentNode.data.modal?.key}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            data.modal ??= {}
            data.modal.key = (v || '') as string
          })
        }}
      />
      <EditItem
        label="API URL"
        placeholder="https://api.example.com"
        value={currentNode.data.modal?.url}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            data.modal ??= {}
            data.modal.url = (v || '') as string
          })
        }}
      />
      <div className="line_row">
        <Text>Token 范围</Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <EditItem
          label=""
          placeholder="min"
          inputType="number"
          min={0}
          value={currentNode.data.modal?.token?.min}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              const data = d(draft)
              data.modal ??= {}
              data.modal.token ??= { min: 0, max: 0 }
              data.modal.token.min = v as number
            })
          }}
        />
        <span>~</span>
        <EditItem
          label=""
          placeholder="max"
          inputType="number"
          min={0}
          value={currentNode.data.modal?.token?.max}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              const data = d(draft)
              data.modal ??= {}
              data.modal.token ??= { min: 0, max: 0 }
              data.modal.token.max = v as number
            })
          }}
        />
      </div>
    </>
  )
}
