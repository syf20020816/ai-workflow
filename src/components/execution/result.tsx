import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import { useEffect, useState } from 'react'
import { Typography, Tag, Input, Space, Button, Timeline } from 'antd'
import type { LogEntry } from '#/types/engine'
import { CodeEditor } from '#/components/file-editor/editor'

const { Text } = Typography

const levelColorMap: Record<LogEntry['level'], string> = {
  info: 'green',
  warn: 'orange',
  error: 'red',
  debug: 'default',
}

/**
 * # 执行结果组件
 * 显示执行状态、等待输入、日志和最终执行结果。
 */
export const ExecutionResult = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const nodes = useNodeStore((state) => state.nodes)
  const resumeFrom = useNodeStore((state) => state.resumeFrom)
  const { nodeOutputs, globalStatus, logs } = pipelineContext

  const [result, setResult] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
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

  useEffect(() => {
    const executedNodeIds = Object.keys(nodeOutputs)
    if (executedNodeIds.length === 0) {
      setResult('')
      setSourceLabel('')
      return
    }

    // 优先找 AI_OUTPUT 类型节点
    const aiOutputNode = nodes.find(
      (n) =>
        n.type === NodeTypes.AI_OUTPUT &&
        nodeOutputs[n.id] !== undefined,
    )

    if (aiOutputNode) {
      const output = nodeOutputs[aiOutputNode.id]
      const title =
        typeof aiOutputNode.data.title === 'string'
          ? aiOutputNode.data.title
          : 'AI 输出'
      setSourceLabel(title)
      setResult(formatOutput(output))
      return
    }

    // 否则取最后执行的节点
    const lastNodeId = executedNodeIds[executedNodeIds.length - 1]
    const lastNode = nodes.find((n) => n.id === lastNodeId)
    const output = nodeOutputs[lastNodeId]
    const title =
      lastNode && typeof lastNode.data.title === 'string'
        ? lastNode.data.title
        : '最后节点'
    setSourceLabel(title)
    setResult(formatOutput(output))
  }, [nodeOutputs, nodes])

  const statusColorMap: Record<string, string> = {
    idle: 'default',
    running: 'processing',
    completed: 'success',
    error: 'error',
    paused: 'warning',
  }

  const statusLabelMap: Record<string, string> = {
    idle: '未执行',
    running: '执行中',
    completed: '已完成',
    error: '出错',
    paused: '等待输入',
  }

  return (
    <div>
      {/* 执行状态 */}
      {globalStatus !== 'idle' && (
        <div style={{ marginBottom: 8 }}>
          <Tag color={statusColorMap[globalStatus] || 'default'}>
            {statusLabelMap[globalStatus] || globalStatus}
          </Tag>
        </div>
      )}

      {/* Answer 节点输入面板 */}
      {globalStatus === 'paused' && waitingOutput && (
        <div
          style={{
            margin: '8px 0',
            padding: 8,
            border: '1px solid var(--xy-edge-stroke-default)',
            borderRadius: 4,
            backgroundColor: 'var(--xy-node-background-color)',
          }}
        >
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
                  onClick={() => setReplyText(opt)}
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

      {/* 执行结果 */}
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          执行结果
        </Text>
      </div>
      {!result ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
          <Text type="secondary">
            {globalStatus === 'idle'
              ? '暂无执行结果'
              : globalStatus === 'running'
                ? '正在执行...'
                : '无输出数据'}
          </Text>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              来源: {sourceLabel}
            </Text>
          </div>
          <div style={{ borderRadius: 4, overflow: 'hidden' }}>
            <CodeEditor value={result} readOnly maxHeight={300} />
          </div>
        </>
      )}

      {/* 执行日志 */}
      {logs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 13 }}>
            执行日志
          </Text>
          <div style={{ marginTop: 8, height: 'calc(100vh - 400px)', overflow: "auto" }}>
            <Timeline
              items={logs.map((log, i) => ({
                color: levelColorMap[log.level] || 'blue',
                content: (
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <Text
                      style={{
                        color: '#888',
                        whiteSpace: 'nowrap',
                        marginRight: 8,
                      }}
                    >
                      {log.nodeTitle}
                    </Text>
                    <Text>{log.message}</Text>
                  </div>
                ),
              }))}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** 将 output 对象格式化为可读字符串 */
function formatOutput(output: Record<string, any> | undefined): string {
  if (!output) return ''

  const keys = Object.keys(output)
  if (keys.length === 1) {
    const val = output[keys[0]]
    if (typeof val === 'string') return val
    return JSON.stringify(val, null, 2)
  }

  return JSON.stringify(output, null, 2)
}
