import { useNodeStore } from '#/store/node'
import type { NMemory, NMemoryData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography } from 'antd'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NMemoryData

export const EditMemory = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NMemory>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows: DynEditKVRow[] = [
    {
      key: 'memoryPath',
      label: '记忆文件路径',
      value: currentNode.data.memoryPath,
      placeholder: '如: memory/memory.md',
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          记忆节点会在执行时读取指定的记忆文件内容，并传递给下游节点。记忆文件可在「规则与记忆」页面编辑。
        </Text>
      </div>

      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'memoryPath') {
              data.memoryPath = (value || 'memory/memory.md') as string
            }
          })
        }}
      />
    </>
  )
}
