import { useNodeStore } from '#/store/node'
import styles from './index.module.scss'
import { Button, Typography, Tag, Input, Space, Select, message } from 'antd'
import { PlayIcon, ResetIcon } from '@radix-ui/react-icons'
import type { LogEntry } from '#/types/engine'
import { useState } from 'react'
import { WorkflowImportExport } from './importExport'

const { Text } = Typography

const levelColorMap: Record<LogEntry['level'], string> = {
  info: 'blue',
  warn: 'orange',
  error: 'red',
  debug: 'default',
}

export const ExecutionPanel = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const nodes = useNodeStore((state) => state.nodes)
  const runAll = useNodeStore((state) => state.runAll)
  const resetExecution = useNodeStore((state) => state.resetExecution)
  const resumeFrom = useNodeStore((state) => state.resumeFrom)
  const runFromWithPinned = useNodeStore((state) => state.runFromWithPinned)
  const workflowId = useNodeStore((state) => state.workflowId)
  const pinnedNodes = useNodeStore((state) => state.pinnedNodes)

  const [replyText, setReplyText] = useState('')
  const [pinnedItems, setPinnedItems] = useState<
    { nodeId: string; title: string }[]
  >([])
  const [selectedPinnedNode, setSelectedPinnedNode] = useState<string | null>(
    null,
  )
  const [pinnedLoading, setPinnedLoading] = useState(false)

  // 找到处于 waiting 状态的节点
  const waitingNodeEntry = Object.entries(pipelineContext.nodeStatuses).find(
    ([, status]) => status === 'waiting',
  )
  const waitingNodeId = waitingNodeEntry?.[0]
  const waitingOutput = waitingNodeId
    ? pipelineContext.nodeOutputs[waitingNodeId]
    : null

  const handleResume = () => {
    if (waitingNodeId && replyText.trim()) {
      resumeFrom(waitingNodeId, replyText.trim())
      setReplyText('')
    }
  }

  const handleRun = () => {
    if (selectedPinnedNode && selectedPinnedNode in pinnedNodes) {
      // 从 PIN 节点开始执行
      const overrides: Record<string, Record<string, any>> = {}
      for (const [nid, output] of Object.entries(pinnedNodes)) {
        if (output) overrides[nid] = output
      }
      runFromWithPinned(selectedPinnedNode, overrides)
    } else {
      // 从头执行
      runAll()
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <WorkflowImportExport />

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
          <Button block type="primary" icon={<PlayIcon />} onClick={handleRun}>
            运行{selectedPinnedNode ? '（从PIN）' : ''}
          </Button>
        )}
        {pipelineContext.globalStatus !== 'idle' && (
          <Button block icon={<ResetIcon />} onClick={resetExecution}>
            重置
          </Button>
        )}
      </div>

      {/* 执行状态 */}
      {pipelineContext.globalStatus !== 'idle' && (
        <div className={styles.status_bar}>
          <Tag
            color={
              pipelineContext.globalStatus === 'running'
                ? 'processing'
                : pipelineContext.globalStatus === 'completed'
                  ? 'success'
                  : pipelineContext.globalStatus === 'error'
                    ? 'error'
                    : 'warning'
            }
          >
            {pipelineContext.globalStatus === 'running' && '执行中'}
            {pipelineContext.globalStatus === 'completed' && '已完成'}
            {pipelineContext.globalStatus === 'error' && '出错'}
            {pipelineContext.globalStatus === 'paused' && '等待输入'}
          </Tag>
        </div>
      )}

      {/* Answer 节点输入面板 */}
      {pipelineContext.globalStatus === 'paused' && waitingOutput && (
        <div className={styles.answer_input}>
          <Text strong style={{ fontSize: 12 }}>
            {waitingOutput.question || '请输入:'}
          </Text>
          {waitingOutput.options && waitingOutput.options.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                marginTop: 4,
              }}
            >
              {waitingOutput.options.map((opt: string) => (
                <Tag
                  key={opt}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setReplyText(opt)
                  }}
                >
                  {opt}
                </Tag>
              ))}
            </div>
          )}
          <Space.Compact style={{ width: '100%', marginTop: 8 }}>
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onPressEnter={handleResume}
              placeholder="输入回复..."
              size="small"
            />
            <Button
              type="primary"
              size="small"
              onClick={handleResume}
              disabled={!replyText.trim()}
            >
              提交
            </Button>
          </Space.Compact>
        </div>
      )}

      {/* 日志列表 */}
      {pipelineContext.logs.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 14 }}>
            执行日志
          </Text>
          <div className={styles.log_container}>
            {pipelineContext.logs.map((log, i) => (
              <div key={i} className={styles.log_item}>
                <Tag
                  color={levelColorMap[log.level]}
                  style={{ fontSize: 12, lineHeight: '14px', padding: '0 4px' }}
                >
                  {log.level}
                </Tag>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#888',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {log.nodeTitle}
                </Text>
                <Text style={{ fontSize: 12 }}>{log.message}</Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
