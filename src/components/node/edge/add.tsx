import { Button, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import styles from '../index.module.scss'
import { CirclePlus } from 'lucide-react'
import { NodeTypes } from '#/types'
import type { NodeType, AppNode } from '#/types'
import { NodeHeader } from '../header'
import { useNodeStore } from '#/store/node'
import { NodeBuilder } from '#/types/builder'
import type { ReactNode } from 'react'

export interface AddNodeBtnProps {
  kind?: NodeType
  children?: ReactNode
  trigger?: ('click' | 'contextMenu' | 'hover')[]
}

const isDisabledNode = (parent: NodeType | undefined, child: NodeType) => {
  if (!parent) {
    return false
  }
  // // 用户输入节点只能连接 智能体节点
  // if (parent === NodeTypes.USER_INPUT) {
  //   return child !== NodeTypes.AGENT
  // }
  // 智能体节点不能连接 用户输入节点 和 智能体节点自身
  if (parent === NodeTypes.AGENT) {
    return child === NodeTypes.USER_INPUT || child === NodeTypes.AGENT
  }

  // codeNode 必须连接在 AgentNode 或 BMadNode 之后
  // if (child === NodeTypes.CODE) {
  //   return parent === NodeTypes.AGENT || parent === NodeTypes.BMAD_AGENT || parent === NodeTypes.USER_INPUT
  // }

  // ifConditionNode 只能跟在 ifNode 之后
  if (child === NodeTypes.IF_CONDITION) {
    return parent !== NodeTypes.IF
  }

  // loopConditionNode 只能跟在 loopNode 之后
  if (child === NodeTypes.LOOP_CONDITION) {
    return parent !== NodeTypes.LOOP
  }

  return false
}

export const AddNodeBtn = ({
  kind,
  children,
  trigger = ['click'],
}: AddNodeBtnProps) => {
  const currentNode = useNodeStore((state) => state.currentNode)
  const addConnectNode = useNodeStore((state) => state.addConnectNode)
  const addUnConnectNode = useNodeStore((state) => state.addUnConnectNode)

  const pos = currentNode
    ? {
        x: currentNode.positionAbsoluteX,
        y: currentNode.positionAbsoluteY,
      }
    : { x: 0, y: 0 }

  const addNode = (builderFn: (pos: { x: number; y: number }) => AppNode) => {
    const node = builderFn(pos)

    if (!node) {
      return
    }

    if (!kind) {
      addUnConnectNode(node)
    } else {
      addConnectNode(node)
    }
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'input',
      label: '输入节点',
      type: 'group',
      children: [
        {
          label: (
            <NodeHeader kind={NodeTypes.USER_INPUT} title="用户输入节点" />
          ),
          key: NodeTypes.USER_INPUT,
          disabled: isDisabledNode(kind, NodeTypes.USER_INPUT),
          onClick: () => addNode(NodeBuilder.userInput),
        },
        {
          label: <NodeHeader kind={NodeTypes.ANSWER} title="回答节点" />,
          key: NodeTypes.ANSWER,
          disabled: isDisabledNode(kind, NodeTypes.ANSWER),
          onClick: () => addNode(NodeBuilder.answer),
        },
        {
          label: <NodeHeader kind={NodeTypes.MEMORY} title="记忆节点" />,
          key: NodeTypes.MEMORY,
          disabled: isDisabledNode(kind, NodeTypes.MEMORY),
          onClick: () => addNode(NodeBuilder.memory),
        },
        {
          label: <NodeHeader kind={NodeTypes.SKILL} title="Skill节点" />,
          key: NodeTypes.SKILL,
          disabled: isDisabledNode(kind, NodeTypes.SKILL),
          onClick: () => addNode(NodeBuilder.skill),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.BMAD_AGENT} title="BMad角色节点" />
          ),
          key: NodeTypes.BMAD_AGENT,
          disabled: isDisabledNode(kind, NodeTypes.BMAD_AGENT),
          onClick: () => addNode(NodeBuilder.bmadAgent),
        },
      ],
    },
    {
      key: 'plugin',
      label: '插件节点',
      type: 'group',
      children: [
        {
          label: <NodeHeader kind={NodeTypes.LARK} title="Lark文档节点" />,
          key: NodeTypes.LARK,
          disabled: isDisabledNode(kind, NodeTypes.LARK),
          onClick: () => addNode(NodeBuilder.lark),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.LARK_TEMPLATE} title="Lark模板节点" />
          ),
          key: NodeTypes.LARK_TEMPLATE,
          disabled: isDisabledNode(kind, NodeTypes.LARK_TEMPLATE),
          onClick: () => addNode(NodeBuilder.larkTemplate),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.LARK_WIKI_TRAVERSAL} title="Lark知识库节点" />
          ),
          key: NodeTypes.LARK_WIKI_TRAVERSAL,
          disabled: isDisabledNode(kind, NodeTypes.LARK_WIKI_TRAVERSAL),
          onClick: () => addNode(NodeBuilder.larkWikiTraversal),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.KNOWLEDGE_RETRIEVAL} title="知识库检索节点" />
          ),
          key: NodeTypes.KNOWLEDGE_RETRIEVAL,
          disabled: isDisabledNode(kind, NodeTypes.KNOWLEDGE_RETRIEVAL),
          onClick: () => addNode(NodeBuilder.knowledgeRetrieval),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.KNOWLEDGE_STORE} title="知识库写入节点" />
          ),
          key: NodeTypes.KNOWLEDGE_STORE,
          disabled: isDisabledNode(kind, NodeTypes.KNOWLEDGE_STORE),
          onClick: () => addNode(NodeBuilder.knowledgeStore),
        },
        
      ],
    },
    {
      key: 'process',
      label: '处理节点',
      type: 'group',
      children: [
        {
          label: <NodeHeader kind={NodeTypes.AGENT} title="智能体节点" />,
          key: NodeTypes.AGENT,
          disabled: isDisabledNode(kind, NodeTypes.AGENT),
          onClick: () => addNode(NodeBuilder.agent),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.CODE_AGENT} title="代码分析节点" />
          ),
          key: NodeTypes.CODE_AGENT,
          disabled: isDisabledNode(kind, NodeTypes.CODE_AGENT),
          onClick: () => addNode(NodeBuilder.codeAgent),
        },
      ],
    },
    {
      key: 'output',
      label: '输出节点',
      type: 'group',
      children: [
        {
          label: <NodeHeader kind={NodeTypes.AI_OUTPUT} title="AI输出节点" />,
          key: NodeTypes.AI_OUTPUT,
          disabled: isDisabledNode(kind, NodeTypes.AI_OUTPUT),
          onClick: () => addNode(NodeBuilder.aiOutput),
        },
      ],
    },

    {
      key: 'control',
      label: '控制节点',
      children: [
        {
          label: <NodeHeader kind={NodeTypes.IF} title="判断节点" />,
          key: NodeTypes.IF,
          disabled: isDisabledNode(kind, NodeTypes.IF),
          onClick: () => addNode(NodeBuilder.ifNode),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.IF_CONDITION} title="条件分支节点" />
          ),
          key: NodeTypes.IF_CONDITION,
          disabled: isDisabledNode(kind, NodeTypes.IF_CONDITION),
          onClick: () => addNode(NodeBuilder.ifCondition),
        },
        {
          label: <NodeHeader kind={NodeTypes.LOOP} title="循环节点" />,
          key: NodeTypes.LOOP,
          disabled: isDisabledNode(kind, NodeTypes.LOOP),
          onClick: () => addNode(NodeBuilder.loop),
        },
        {
          label: (
            <NodeHeader kind={NodeTypes.LOOP_CONDITION} title="循环条件节点" />
          ),
          key: NodeTypes.LOOP_CONDITION,
          disabled: isDisabledNode(kind, NodeTypes.LOOP_CONDITION),
          onClick: () => addNode(NodeBuilder.loopCondition),
        },
        {
          label: <NodeHeader kind={NodeTypes.RETRY} title="重试节点" />,
          key: NodeTypes.RETRY,
          disabled: isDisabledNode(kind, NodeTypes.RETRY),
          onClick: () => addNode(NodeBuilder.retry),
        },
      ],
    },
  ]

  return (
    <Dropdown menu={{ items: menuItems }} trigger={trigger}>
      {children ?? (
        <Button
          type="primary"
          size="small"
          className={styles.add_button}
          styles={{
            root: {
              height: 12,
              width: 12,
              padding: 0,
            },
          }}
        >
          <CirclePlus size={8}></CirclePlus>
        </Button>
      )}
    </Dropdown>
  )
}
