import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import { useEffect, useState } from 'react'
import { Typography, Tag } from 'antd'

const { Text } = Typography

/**
 * # 执行结果组件
 * 获取 AI_OUTPUT 节点的执行结果并展示。
 * 如果没有 AI_OUTPUT 节点，则获取 pipeline 最后一个节点的执行结果。
 */
export const ExecutionResult = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const nodes = useNodeStore((state) => state.nodes)
  const { nodeOutputs, globalStatus } = pipelineContext

  const [result, setResult] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          执行结果
        </Text>
        <Tag color={statusColorMap[globalStatus] || 'default'}>
          {statusLabelMap[globalStatus] || globalStatus}
        </Tag>
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
          <pre
            style={{
              fontSize: 12,
              overflow: 'auto',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              backgroundColor: 'var(--deep-color)',
              padding: 8,
              borderRadius: 4,
              maxHeight: 400,
            }}
          >
            {result}
          </pre>
        </>
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
