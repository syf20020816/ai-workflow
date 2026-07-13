import { useNodeStore } from '#/store/node'
import type { NCode, NCodeData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'
import { Select, Typography, Button, InputNumber } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NCodeData

export const EditCode = () => {
  const currentNode = useNodeStore((state) => state.currentNode) as NodeProps<NCode>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const lines = currentNode.data.lines || []

  const addLineRange = () => {
    const last = lines[lines.length - 1]
    const start = last.end + 1 || 1
    patchCurrentNode((draft) => {
      const data = d(draft)
      data.lines = [...(data.lines || []), { start, end: start + 10 }]
    })
  }

  const updateLineRange = (idx: number, field: 'start' | 'end', value: number | null) => {
    patchCurrentNode((draft) => {
      const data = d(draft)
      const newLines = [...(data.lines || [])]
      const current = newLines[idx] || { start: 1, end: 11 }
      const newValue = value ?? 1
      let updated: { start: number; end: number }
      if (field === 'start') {
        updated = { start: newValue, end: Math.max(newValue, current.end) }
      } else {
        updated = { start: Math.min(newValue, current.start), end: newValue }
      }
      newLines[idx] = updated
      data.lines = newLines
    })
  }

  const removeLineRange = (idx: number) => {
    patchCurrentNode((draft) => {
      const data = d(draft)
      data.lines = (data.lines || []).filter((_, i) => i !== idx)
    })
  }

  return (
    <>
      <div className="line">
        <Text>运行模式</Text>
        <Select
          style={{ width: '100%' }}
          value={currentNode.data.mode}
          options={[
            { label: '本地', value: 'local' },
            { label: '云端', value: 'cloud' },
          ]}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).mode = v
            })
          }}
        />
      </div>

      <EditItem
        label="文件路径"
        placeholder="如：/path/to/file.ts 或 ./src/main.ts"
        value={currentNode.data.repoUrl}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).repoUrl = (v || '') as string
          })
        }}
      />

      <EditItem
        label="分支"
        placeholder="默认: master"
        value={currentNode.data.branch}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).branch = (v || 'master') as string
          })
        }}
      />

      {/* 行范围配置 */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text strong style={{ fontSize: 12 }}>读取行范围</Text>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addLineRange}>
            添加
          </Button>
        </div>
        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>
          不添加任何范围则读取整个文件
        </Text>
        {lines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lines.map((range, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 11, minWidth: 16 }}>{idx + 1}.</Text>
                <InputNumber
                  size="small"
                  min={1}
                  style={{ width: 60 }}
                  placeholder="起始"
                  value={range.start}
                  onChange={(v) => updateLineRange(idx, 'start', v)}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>~</Text>
                <InputNumber
                  size="small"
                  min={1}
                  style={{ width: 60 }}
                  placeholder="结束"
                  value={range.end}
                  onChange={(v) => updateLineRange(idx, 'end', v)}
                />
                {lines.length > 1 && (
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeLineRange(idx)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
