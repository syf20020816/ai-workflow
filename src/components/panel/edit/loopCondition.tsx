import { useNodeStore } from '#/store/node'
import type { NLoopCondition, NLoopConditionData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NLoopConditionData

export const EditLoopCondition = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NLoopCondition>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows: DynEditKVRow[] = [
    {
      key: 'condition',
      label: '循环退出条件',
      value: currentNode.data.condition,
      inputType: 'textArea',
      rows: 2,
      placeholder: '描述循环在什么时候退出',
    },
  ]

  return (
    <>
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'condition') data.condition = (value || '') as string
          })
        }}
      />
      <div style={{ fontSize: 10, color: 'var(--xy-edge-stroke-default)', marginTop: 4 }}>
        <p style={{ margin: 0 }}>从该节点连接而出的节点是循环结束后执行的节点。</p>
      </div>
    </>
  )
}
