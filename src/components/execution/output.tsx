import { useNodeStore } from '#/store/node'
import { Collapse, Typography } from 'antd'

const { Text } = Typography

export const OutputPanel = () => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const nodes = useNodeStore((state) => state.nodes)

  const outputEntries = nodes.filter(
    (n) => pipelineContext.nodeOutputs[n.id] !== undefined,
  )

  if (outputEntries.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>
        <Text type="secondary">暂无输出数据，请先执行工作流</Text>
      </div>
    )
  }

  return (
    <Collapse
      defaultActiveKey={outputEntries.map((n) => n.id)}
      ghost
      size="small"
      items={outputEntries.map((node) => {
        const output = pipelineContext.nodeOutputs[node.id]
        const title = node.data.title
        return {
          key: node.id,
          label: (
            <Text strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>
              {typeof title === 'string' ? title : '未命名节点'}
            </Text>
          ),
          children: output ? (
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
              {JSON.stringify(output, null, 2)}
            </pre>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              无输出
            </Text>
          ),
        }
      })}
    />
  )
}
