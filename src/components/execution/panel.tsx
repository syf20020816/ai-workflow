import { useNodeStore } from '#/store/node'
import { useGlobalStore } from '#/store/global'
import styles from './index.module.scss'
import { Button, Select, Tooltip } from 'antd'
import { Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export const ExecutionPanel = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const nodes = useNodeStore((state) => state.nodes)
  const pinnedNodes = useNodeStore((state) => state.pinnedNodes)
  const runAll = useNodeStore((state) => state.runAll)
  const resetExecution = useNodeStore((state) => state.resetExecution)
  const runFromWithPinned = useNodeStore((state) => state.runFromWithPinned)
  const globalMode = useGlobalStore((state) => state.globalMode)

  // Spec 模式：执行范围内必须至少有一个节点被标记了阶段，否则禁止运行
  const specDisabled =
    globalMode === 'spec' &&
    !nodes.some((n) => (n.data as { specStep?: string } | undefined)?.specStep)

  const [selectedPinnedKey, setSelectedPinnedKey] = useState<string | null>(
    null,
  )

  // 仅显示「已加载到当前工作流」的 PIN（store.pinnedNodes 按节点 id 隔离），
  // 而非磁盘上所有工作流的 PIN 文件；节点删除后自动不显示
  const pinnedOptions = nodes
    .filter((n) => pinnedNodes[n.id])
    .map((n) => ({
      value: n.id,
      label: `${(n.data as any)?.title || n.type || n.id}（${n.type || '未知'}）`,
    }))

  const handleRun = () => {
    const pin = selectedPinnedKey ? pinnedNodes[selectedPinnedKey] : undefined
    if (selectedPinnedKey && pin?.output) {
      // 以该节点为起点，注入 { [nodeId]: output } 执行（output 已在内存，无需再读文件；
      // PIN 自带的累积上下文由 store.runFromWithPinned 一并注入）
      runFromWithPinned(selectedPinnedKey, { [selectedPinnedKey]: pin.output })
    } else {
      runAll()
    }
  }

  return (
    <div className={styles.panel} style={{ marginBottom: 8 }}>
      <div className={styles.header}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择固定节点（仅显示已加载到本工作流的 PIN）"
          value={selectedPinnedKey}
          onChange={setSelectedPinnedKey}
          allowClear
          notFoundContent="当前工作流没有已加载的 PIN（可在节点编辑面板中固定/加载）"
          options={pinnedOptions}
        />
        {pipelineContext.globalStatus === 'idle' && (
          <Tooltip
            title={
              specDisabled
                ? 'Spec 模式：请先在节点上用脚印按钮标记至少一个阶段'
                : `运行${selectedPinnedKey ? '（用PIN）' : ''}`
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
          <Tooltip title="重置">
            <Button
              icon={<RotateCcw size={14} />}
              onClick={resetExecution}
            ></Button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
