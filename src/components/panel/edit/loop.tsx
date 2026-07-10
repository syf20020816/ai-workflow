import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import type { NLoop, NLoopData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'
import { Button, Divider, Typography, InputNumber, Tag } from 'antd'
import { PlusOutlined, DisconnectOutlined } from '@ant-design/icons'
import { v4 as uuidv4 } from 'uuid'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NLoopData

export const EditLoop = () => {
  const currentNode = useNodeStore((state) => state.currentNode) as NodeProps<NLoop>
  const nodes = useNodeStore((state) => state.nodes)
  const edges = useNodeStore((state) => state.edges)
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)
  const addConnectNode = useNodeStore((state) => state.addConnectNode)
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)

  // 查找当前 loopNode 是否已有 loopConditionNode
  const conditionEdge = edges.find(
    (e) => e.source === currentNode.id && nodes.find((n) => n.id === e.target)?.type === NodeTypes.LOOP_CONDITION,
  )
  const conditionNode = conditionEdge ? nodes.find((n) => n.id === conditionEdge.target) : null
  const conditionData = conditionNode?.data as any | undefined
  const hasCondition = !!conditionNode

  const addCondition = () => {
    if (hasCondition) return
    const pos = currentNode as any
    const node = {
      id: uuidv4(),
      type: NodeTypes.LOOP_CONDITION,
      position: {
        x: (pos.positionAbsoluteX ?? pos.position?.x ?? 0) + 200,
        y: pos.positionAbsoluteY ?? pos.position?.y ?? 0,
      },
      deletable: true,
      draggable: true,
      selectable: true,
      selected: false,
      data: {
        title: '循环条件节点',
        condition: '',
      },
    } as any

    addConnectNode(node)
    setCurrentNode(node)
  }

  const removeCondition = () => {
    if (!conditionEdge || !conditionNode) return
    useNodeStore.getState().setNodes(nodes.filter((n) => n.id !== conditionNode.id))
    useNodeStore.getState().setEdges(edges.filter((e) => e.id !== conditionEdge.id && e.source !== conditionNode.id))
  }

  return (
    <>
      <div className="line">
        <Text>最大循环次数</Text>
        <InputNumber
          style={{ width: '100%' }}
          min={1}
          max={100}
          value={currentNode.data.maxLoopCount}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).maxLoopCount = v ?? 5
            })
          }}
        />
      </div>

      <EditItem
        label="循环条件描述"
        placeholder="什么条件下继续循环"
        inputType="textArea"
        rows={2}
        value={currentNode.data.condition}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).condition = (v || '') as string
          })
        }}
      />

      <Divider style={{ margin: '12px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 12 }}>循环条件节点</Text>
        {!hasCondition ? (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addCondition}>
            添加
          </Button>
        ) : (
          <Button type="text" size="small" danger icon={<DisconnectOutlined />} onClick={removeCondition}>
            移除
          </Button>
        )}
      </div>

      {conditionData && (
        <div style={{ marginTop: 8, padding: 8, background: 'var(--xy-node-background-color)', borderRadius: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>
              {conditionData.condition || '未设置条件'}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
            与该节点相连的节点为循环体；与循环条件节点相连的节点为循环结束后执行的节点
          </Text>
        </div>
      )}

      {!hasCondition && (
        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
          添加循环条件节点后，连入的节点将作为循环体
        </Text>
      )}
    </>
  )
}
