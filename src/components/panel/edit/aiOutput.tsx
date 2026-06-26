import { useNodeStore } from '#/store/node'
import type { NAIOutput, NAIOutputData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NAIOutputData

export const EditAIOutput = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAIOutput>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  return (
    <>
      <EditItem
        label="输出内容"
        placeholder="AI 处理后的输出结果将显示在这里"
        inputType="textArea"
        rows={6}
        value={currentNode.data.content}
        readOnly
      />
      <EditItem
        label="来源智能体"
        placeholder="来源智能体名称"
        value={currentNode.data.sourceAgent}
        readOnly
      />
    </>
  )
}
