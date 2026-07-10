import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import type { NRetry, NRetryData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'
import { Select, Divider, Typography, InputNumber, Tag } from 'antd'
import { NodeBuilder } from '#/types/builder'
import { useEffect } from 'react'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NRetryData

export const EditRetry = () => {
  const currentNode = useNodeStore((state) => state.currentNode) as NodeProps<NRetry>
  const nodes = useNodeStore((state) => state.nodes)
  const edges = useNodeStore((state) => state.edges)
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)
  const addConnectNode = useNodeStore((state) => state.addConnectNode)

  // 查找当前 retryNode 连出的 AgentNode（AI 判断模式）
  const agentEdge = edges.find(
    (e) => e.source === currentNode.id && nodes.find((n) => n.id === e.target)?.type === NodeTypes.AGENT,
  )
  const agentNode = agentEdge ? nodes.find((n) => n.id === agentEdge.target) : null

  // 切换到 AI 模式时，自动创建 AgentNode
  useEffect(() => {
    if (currentNode.data.judgmentMode === 'ai' && !agentNode) {
      const pos = currentNode as any
      const newNode = NodeBuilder.agent({
        x: pos.positionAbsoluteX ?? pos.position?.x ?? 0,
        y: pos.positionAbsoluteY ?? pos.position?.y ?? 0,
      })
      if (newNode) {
        addConnectNode(newNode)
      }
    }
  }, [currentNode.data.judgmentMode])

  return (
    <>
      <div className="line">
        <Text>判断模式</Text>
        <Select
          style={{ width: '100%' }}
          value={currentNode.data.judgmentMode}
          options={[
            { label: '人工判断（关键词匹配）', value: 'manual' },
            { label: 'AI 判断', value: 'ai' },
          ]}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).judgmentMode = v
            })
          }}
        />
      </div>

      <div className="line">
        <Text>重试间隔（秒）</Text>
        <InputNumber
          style={{ width: '100%' }}
          min={0.1}
          max={300}
          step={0.5}
          value={currentNode.data.retryDelay}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).retryDelay = v ?? 1
            })
          }}
        />
      </div>

      <div className="line">
        <Text>最大重试次数</Text>
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          max={100}
          value={currentNode.data.maxRetryCount}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).maxRetryCount = v ?? 5
            })
          }}
        />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {currentNode.data.judgmentMode === 'manual' ? (
        <EditItem
          label="错误关键词"
          placeholder="输入关键词，用逗号分隔。匹配则判定为错误"
          inputType="textArea"
          rows={2}
          value={currentNode.data.errorKeywords}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).errorKeywords = (v || '') as string
            })
          }}
        />
      ) : (
        <div className="line">
          <Text>AI 判断</Text>
          {agentNode ? (
            <div style={{ marginTop: 4 }}>
              <Tag color="purple" style={{ fontSize: 10 }}>
                {String(agentNode.data.title || '')}
              </Tag>
              <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
                已连接 AgentNode，AI 将自动判断是否需要重试
              </Text>
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              将在确认后自动创建 AgentNode 连接
            </Text>
          )}
        </div>
      )}
    </>
  )
}
