import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import type { NIf, NIfData } from '#/types'
import type { NodeProps, Node } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'
import { Button, Divider, Typography, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { v4 as uuidv4 } from 'uuid'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NIfData

export const EditIf = () => {
  const currentNode = useNodeStore((state) => state.currentNode) as NodeProps<NIf>
  const nodes = useNodeStore((state) => state.nodes)
  const edges = useNodeStore((state) => state.edges)
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)
  const addConnectNode = useNodeStore((state) => state.addConnectNode)
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)
  const removeEdge = useNodeStore((state) => state.removeEdge)

  // 查找当前 ifNode 连出了哪些 ifConditionNode
  const conditionEdges = edges.filter(
    (e) => e.source === currentNode.id && nodes.find((n) => n.id === e.target)?.type === NodeTypes.IF_CONDITION,
  )
  const conditionNodes = conditionEdges
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n): n is Node => n !== undefined)

  const addCondition = () => {
    const pos = currentNode as any
    const id = uuidv4()
    const conditionNode = {
      id,
      type: NodeTypes.IF_CONDITION,
      position: {
        x: (pos.positionAbsoluteX ?? pos.position?.x ?? 0) + 200,
        y: (pos.positionAbsoluteY ?? pos.position?.y ?? 0) + conditionEdges.length * 80,
      },
      deletable: true,
      draggable: true,
      selectable: true,
      selected: false,
      data: {
        title: `条件分支 ${conditionEdges.length + 1}`,
        label: `条件${conditionEdges.length + 1}`,
        condition: '',
      },
    }

    addConnectNode(conditionNode as any)
    setCurrentNode(conditionNode as any)
  }

  const rows: DynEditKVRow[] = [
    {
      key: 'expression',
      label: '判断表达式',
      value: currentNode.data.expression,
      inputType: 'textArea',
      rows: 2,
      placeholder: '描述你的判断逻辑',
    },
  ]

  return (
    <>
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            d(draft).expression = (value || '') as string
          })
        }}
      />

      <Divider style={{ margin: '12px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 12 }}>条件分支</Text>
        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addCondition}>
          添加分支
        </Button>
      </div>

      <div style={{ marginTop: 8 }}>
        {conditionNodes.length === 0 && (
          <Text type="secondary" style={{ fontSize: 11 }}>暂无条件分支，请添加</Text>
        )}
        {conditionNodes.map((node) => {
          const data = node.data as any
          const edge = conditionEdges.find((e) => e.target === node.id)
          return (
            <div
              key={node.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: '1px solid var(--xy-edge-stroke-default)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <Tag color="orange" style={{ fontSize: 9, margin: 0 }}>
                  {data.label || `条件`}
                </Tag>
                <Text type="secondary" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                  {data.condition || '未设置条件'}
                </Text>
              </div>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  useNodeStore.getState().setNodes(nodes.filter((n) => n.id !== node.id))
                  if (edge) {
                    removeEdge(edge.id)
                  }
                }}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
