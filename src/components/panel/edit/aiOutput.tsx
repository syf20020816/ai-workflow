import { useNodeStore } from '#/store/node'
import type { NAIOutput } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

export const EditAIOutput = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAIOutput>

  const rows: DynEditKVRow[] = [
    {
      key: 'content',
      label: '输出内容',
      value: currentNode.data.content,
      inputType: 'textArea',
      rows: 6,
      placeholder: 'AI 处理后的输出结果将显示在这里',
      readOnly: true,
    },
    {
      key: 'sourceAgent',
      label: '来源智能体',
      value: currentNode.data.sourceAgent,
      placeholder: '来源智能体名称',
      readOnly: true,
    },
  ]

  return <DynEditKV rows={rows} onChange={() => {}} />
}
