import { useNodeStore } from '#/store/node'
import { useGlobalStore } from '#/store/global'
import styles from './index.module.scss'
import { Button, Select, Tooltip } from 'antd'
import { Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export const ExecutionPanel = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const nodes = useNodeStore((state) => state.nodes)
  const runAll = useNodeStore((state) => state.runAll)
  const resetExecution = useNodeStore((state) => state.resetExecution)
  const runFromWithPinned = useNodeStore((state) => state.runFromWithPinned)
  const globalMode = useGlobalStore((state) => state.globalMode)

  // Spec 模式：执行范围内必须至少有一个节点标记了阶段产物，否则禁止运行
  const specDisabled =
    globalMode === 'spec' && !nodes.some(
      (n) => (n.data as { specStep?: string } | undefined)?.specStep,
    )

  const [pinnedItems, setPinnedItems] = useState<
    { nodeType: string; title: string }[]
  >([])
  const [selectedPinnedType, setSelectedPinnedType] = useState<string | null>(
    null,
  )
  const [pinnedLoading, setPinnedLoading] = useState(false)

  const handleRun = async () => {
    if (selectedPinnedType) {
      // 找到当前工作流中第一个同类型节点作为注入目标
      const matchNode = nodes.find((n) => n.type === selectedPinnedType)
      if (!matchNode) {
        runAll()
        return
      }
      // 从文件系统读取 pin 数据
      const res = await fetch(
        `/api/workflow/pin?nodeType=${encodeURIComponent(selectedPinnedType)}`,
      )
      const json = await res.json()
      if (json.status === 'success') {
        const output = json.data.output
        // 加载到内存（按 nodeId 隔离，只影响匹配的节点）
        useNodeStore.getState().loadPinnedNode(matchNode.id, output)
        // 以该节点为起点，注入 { [nodeId]: output } 执行
        runFromWithPinned(matchNode.id, { [matchNode.id]: output })
      } else {
        runAll()
      }
    } else {
      runAll()
    }
  }

  return (
    <div className={styles.panel} style={{ marginBottom: 8 }}>
      <div className={styles.header}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择固定节点类型（可选）"
          value={selectedPinnedType}
          onChange={setSelectedPinnedType}
          allowClear
          loading={pinnedLoading}
          onDropdownVisibleChange={async (open) => {
            if (open) {
              setPinnedLoading(true)
              try {
                const res = await fetch('/api/workflow/pin')
                const json = await res.json()
                if (json.status === 'success') {
                  setPinnedItems(json.data)
                }
              } catch {
                // ignore
              }
              setPinnedLoading(false)
            }
          }}
          options={pinnedItems.map((p) => ({
            value: p.nodeType,
            label: `${p.title}（${p.nodeType}）`,
          }))}
        />
        {pipelineContext.globalStatus === 'idle' && (
          <Tooltip
            title={
              specDisabled
                ? 'Spec 模式：请先在节点上用脚印按钮标记至少一个阶段产物'
                : `运行${selectedPinnedType ? '（用PIN）' : ''}`
            }
          >
            <Button
              type="primary"
              icon={<Play size={14} />}
              onClick={handleRun}
              disabled={specDisabled}
            ></Button>
          </Tooltip>
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
