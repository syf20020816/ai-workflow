import { useNodeStore } from '#/store/node'
import styles from './index.module.scss'
import { Button, Select } from 'antd'
import { Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export const ExecutionPanel = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const runAll = useNodeStore((state) => state.runAll)
  const resetExecution = useNodeStore((state) => state.resetExecution)
  const runFromWithPinned = useNodeStore((state) => state.runFromWithPinned)
  const workflowId = useNodeStore((state) => state.workflowId)
  const pinnedNodes = useNodeStore((state) => state.pinnedNodes)

  const [pinnedItems, setPinnedItems] = useState<
    { nodeId: string; title: string }[]
  >([])
  const [selectedPinnedNode, setSelectedPinnedNode] = useState<string | null>(
    null,
  )
  const [pinnedLoading, setPinnedLoading] = useState(false)

  const handleRun = () => {
    if (selectedPinnedNode && selectedPinnedNode in pinnedNodes) {
      const overrides: Record<string, Record<string, any>> = {}
      for (const [nid, output] of Object.entries(pinnedNodes)) {
        if (output) overrides[nid] = output
      }
      runFromWithPinned(selectedPinnedNode, overrides)
    } else {
      runAll()
    }
  }

  return (
    <div className={styles.panel} style={{ marginBottom: 8 }}>
      <div className={styles.header}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择固定节点（可选）"
          value={selectedPinnedNode}
          onChange={setSelectedPinnedNode}
          allowClear
          loading={pinnedLoading}
          onDropdownVisibleChange={async (open) => {
            if (open) {
              setPinnedLoading(true)
              try {
                const res = await fetch(
                  `/api/workflow/pin?workflowId=${workflowId}`,
                )
                const json = await res.json()
                if (json.status === 'success') {
                  setPinnedItems(json.data)
                  for (const item of json.data) {
                    if (!(item.nodeId in pinnedNodes)) {
                      const r = await fetch(
                        `/api/workflow/pin?workflowId=${workflowId}&nodeId=${item.nodeId}`,
                      )
                      const j = await r.json()
                      if (j.status === 'success') {
                        useNodeStore
                          .getState()
                          .loadPinnedNode(item.nodeId, j.data.output)
                      }
                    }
                  }
                }
              } catch {
                // ignore
              }
              setPinnedLoading(false)
            }
          }}
          options={pinnedItems.map((p) => ({
            value: p.nodeId,
            label: `${p.title} (${p.nodeId.slice(0, 8)})`,
          }))}
        />
        {pipelineContext.globalStatus === 'idle' && (
          <Button type="primary" icon={<Play size={14} />} onClick={handleRun}>
            运行{selectedPinnedNode ? '（从PIN）' : ''}
          </Button>
        )}
        {pipelineContext.globalStatus !== 'idle' && (
          <Button icon={<RotateCcw size={14} />} onClick={resetExecution}>
            重置
          </Button>
        )}
      </div>
    </div>
  )
}
