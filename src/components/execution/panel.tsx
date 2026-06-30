import { useNodeStore } from '#/store/node'
import styles from './index.module.scss'
import { Button, Typography, Collapse, Tag, Input, Space } from 'antd'
import { PlayIcon, ResetIcon } from '@radix-ui/react-icons'
import type { LogEntry } from '#/types/engine'
import { useState } from 'react'

const { Text } = Typography

const levelColorMap: Record<LogEntry['level'], string> = {
  info: 'blue',
  warn: 'orange',
  error: 'red',
  debug: 'default',
}

export const ExecutionPanel = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const runAll = useNodeStore((state) => state.runAll)
  const resetExecution = useNodeStore((state) => state.resetExecution)
  const resumeFrom = useNodeStore((state) => state.resumeFrom)

  const [replyText, setReplyText] = useState('')

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

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        {pipelineContext.globalStatus === 'idle' && (
          <Button block type="primary" icon={<PlayIcon />} onClick={runAll}>
            运行
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

      {/* 节点输出预览 */}
      {Object.keys(pipelineContext.nodeOutputs).length > 0 && (
        <Collapse
          styles={{
            root: { padding: 0 },
            header: { padding: '4px 0' },
            body: { padding: 0 },
          }}
          ghost
          size="small"
          items={Object.entries(pipelineContext.nodeOutputs).map(
            ([nodeId, output]) => ({
              key: nodeId,
              label: (
                <Text style={{ fontSize: 12 }}>
                  节点 {nodeId.slice(0, 8)} 输出
                </Text>
              ),
              children: (
                <pre className={styles.output_pre}>
                  {JSON.stringify(output, null, 2)}
                </pre>
              ),
            }),
          )}
        />
      )}
    </div>
  )
}
