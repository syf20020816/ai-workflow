import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import styles from '../index.module.scss'
import { PlusCircledIcon } from '@radix-ui/react-icons'
import { NodeTypes } from '#/types'
import type { NodeType, AppNode } from '#/types'
import { NodeHeader } from '../header'
import { useNodeStore } from '#/store/node'
import { NodeBuilder } from '#/types/builder'

export interface AddNodeBtnProps {
  kind: NodeType
}

const isDisabledNode = (parent: NodeType, child: NodeType) => {
  // 用户输入节点只能连接 智能体节点
  if (parent === NodeTypes.USER_INPUT) {
    return child !== NodeTypes.AGENT
  }
  // 智能体节点不能连接 用户输入节点 和 智能体节点自身
  if (parent === NodeTypes.AGENT) {
    return child === NodeTypes.USER_INPUT || child === NodeTypes.AGENT
  }
   
//   if (parent === NodeTypes.AI_OUTPUT) {
//     return child === NodeTypes.ANSWER
//   }
//   // 回答节点只能连接 AI输出节点
//   if (parent === NodeTypes.ANSWER) {
//     return child === NodeTypes.AI_OUTPUT
//   }
  return false
}

export const AddNodeBtn = ({ kind }: AddNodeBtnProps) => {
  const currentNode = useNodeStore((state) => state.currentNode)
  const addConnectNode = useNodeStore((state) => state.addConnectNode)

  const pos = currentNode
    ? {
        x: currentNode.positionAbsoluteX,
        y: currentNode.positionAbsoluteY,
      }
    : { x: 0, y: 0 }

  const addNode = (builderFn: (pos: { x: number; y: number }) => AppNode) => {
    const node = builderFn(pos)
    console.error(node);
    if (node) {
      addConnectNode(node)
    }
  }

  const menuItems: MenuProps['items'] = [
    {
      label: <NodeHeader kind={NodeTypes.USER_INPUT} title="用户输入节点" />,
      key: NodeTypes.USER_INPUT,
      disabled: isDisabledNode(kind, NodeTypes.USER_INPUT),
      onClick: () => addNode(NodeBuilder.userInput),
    },
    {
      label: <NodeHeader kind={NodeTypes.AGENT} title="智能体节点" />,
      key: NodeTypes.AGENT,
      disabled: isDisabledNode(kind, NodeTypes.AGENT),
      onClick: () => addNode(NodeBuilder.agent),
    },
    {
      label: <NodeHeader kind={NodeTypes.AI_OUTPUT} title="AI输出节点" />,
      key: NodeTypes.AI_OUTPUT,
      disabled: isDisabledNode(kind, NodeTypes.AI_OUTPUT),
      onClick: () => addNode(NodeBuilder.aiOutput),
    },
    {
      type: 'divider',
    },
    {
      label: <NodeHeader kind={NodeTypes.ANSWER} title="回答节点" />,
      key: NodeTypes.ANSWER,
      disabled: isDisabledNode(kind, NodeTypes.ANSWER),
      onClick: () => addNode(NodeBuilder.answer),
    },
    {
      label: <NodeHeader kind={NodeTypes.BMAD_AGENT} title="BMad角色节点" />,
      key: NodeTypes.BMAD_AGENT,
      disabled: isDisabledNode(kind, NodeTypes.BMAD_AGENT),
      onClick: () => addNode(NodeBuilder.bmadAgent),
    },
    {
      label: <NodeHeader kind={NodeTypes.LARK} title="Lark文档节点" />,
      key: NodeTypes.LARK,
      disabled: isDisabledNode(kind, NodeTypes.LARK),
      onClick: () => addNode(NodeBuilder.lark),
    },
  ]

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']}>
      <Button
        type="primary"
        size="small"
        className={styles.add_button}
        styles={{
          root: {
            height: 12,
            width: 12,
          },
        }}
        icon={<PlusCircledIcon height={8} width={8}></PlusCircledIcon>}
      ></Button>
    </Dropdown>
  )
}
