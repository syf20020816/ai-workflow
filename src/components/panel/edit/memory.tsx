import { useNodeStore } from '#/store/node'
import type { NMemory, NMemoryData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Select, Typography } from 'antd'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'
import { useEffect, useState } from 'react'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NMemoryData

export const EditMemory = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NMemory>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const [memoryFiles, setMemoryFiles] = useState<string[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  // 加载 memory/ 目录下的记忆文件
  useEffect(() => {
    const load = async () => {
      setLoadingFiles(true)
      try {
        const res = await fetch('/api/editor/list')
        const data = await res.json()
        if (data.status === 'success') {
          const group = data.data.find((g: any) => g.title.startsWith('记忆'))
          setMemoryFiles((group?.files || []).map((f: any) => f.name))
        }
      } catch { /* 静默 */ }
      setLoadingFiles(false)
    }
    load()
  }, [])

  const rows: DynEditKVRow[] = [
    {
      key: 'memoryPath',
      label: '记忆文件',
      valueRender: (onChange) => (
        <Select
          style={{ width: '100%' }}
          loading={loadingFiles}
          placeholder="选择记忆文件"
          value={currentNode.data.memoryPath || 'memory/memory.md'}
          options={memoryFiles.map((f) => ({
            label: f,
            value: `memory/${f}`,
          }))}
          onChange={(val) => onChange(val)}
        />
      ),
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
