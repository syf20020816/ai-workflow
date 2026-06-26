import { useNodeStore } from '#/store/node'
import type { NBMadAgent, NBMadAgentData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NBMadAgentData

export const EditBMADAgent = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NBMadAgent>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

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
      <EditItem
        label="模型"
        placeholder="如：claude-3-5-sonnet"
        value={currentNode.data.model}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).model = (v || '') as string
          })
        }}
      />
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
