import { useEffect } from 'react'
import { ReactFlow, Background, MiniMap } from '@xyflow/react'
import { Controls } from './controls'

import { UserInputNode } from './node/user/input'
import { AgentNode } from './node/ai/agent'
import { AIOutputNode } from './node/ai/output'
import { AnswerNode } from './node/ai/answer'
import { BmadAgentNode } from './node/ai/bmad'
import { LarkNode } from './node/ai/lark'
import { LarkTemplateNode } from './node/ai/larkTemplate'
import { CodeAgentNode } from './node/ai/codeAgent'
import { SkillNode } from './node/ai/skill'
import { IfNode } from './node/control/if'
import { IfConditionNode } from './node/control/ifCondition'
import { LoopNode } from './node/control/loop'
import { LoopConditionNode } from './node/control/loopCondition'
import { RetryNode } from './node/control/retry'

import { useNodeStore } from '#/store/node'
import { NodeEdge } from './edge'
import { AddNodeBtn } from './node/edge/add'
import { ToolsPanel } from './panel/tools'

import { MemoryNode } from './node/ai/memory'
import { KnowledgeRetrievalNode } from './node/ai/knowledgeRetrieval'
import { KnowledgeStoreNode } from './node/ai/knowledgeStore'
import { KeywordAgentNode } from './node/ai/keywordAgent'
import { TaskPlannerNode } from './node/ai/taskPlanner'
import { LarkWikiTraversalNode } from './node/ai/larkWikiTraversal'
import { EditPanel } from './panel/edit'
import type { NodeType } from '#/types'
import { GroupPanel } from './panel/tools/group'
import { StepLinePanel } from './panel/tools/stepLine'

export const NODE_TYPES = {
  userInput: UserInputNode,
  agent: AgentNode,
  aiOutput: AIOutputNode,
  answer: AnswerNode,
  bmadAgent: BmadAgentNode,
  lark: LarkNode,
  larkTemplate: LarkTemplateNode,
  codeAgent: CodeAgentNode,
  skill: SkillNode,
  if: IfNode,
  ifCondition: IfConditionNode,
  loop: LoopNode,
  loopCondition: LoopConditionNode,
  retry: RetryNode,
  memory: MemoryNode,
  knowledgeRetrieval: KnowledgeRetrievalNode,
  knowledgeStore: KnowledgeStoreNode,
  keywordAgent: KeywordAgentNode,
  taskPlanner: TaskPlannerNode,
  larkWikiTraversal: LarkWikiTraversalNode,
}

export const NODE_COLORS = {
  userInput: '#10a6f5',
  agent: '#985debff',
  aiOutput: '#52c41a',
  answer: '#fa8c16',
  bmadAgent: '#eb2f96',
  lark: '#1677ff',
  larkTemplate: '#1677ff',
  codeAgent: '#985debff',
  skill: '#985debff',
  if: '#fa8c16',
  ifCondition: '#ff7a45',
  loop: '#1890ff',
  loopCondition: '#1890ff',
  retry: '#eb2f96',
  memory: '#eb2f96',
  knowledgeRetrieval: '#52c41a',
  knowledgeStore: '#52c41a',
  larkWikiTraversal: '#1677ff',
  keywordAgent: '#985debff',
  taskPlanner: '#13c2c2',
}

const EDGE_TYPES = {
  nodeEdge: NodeEdge,
}

export function Flow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    removeConnectedBmad,
    setCurrentNode,
  } = useNodeStore()

  // 监听 BMad 断开事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.nodeId) {
        const bmadNode = nodes.find((n) => n.id === detail.nodeId)
        if (bmadNode) {
          setCurrentNode(bmadNode as any)
          removeConnectedBmad()
        }
      }
    }
    window.addEventListener('bmad:disconnect', handler)
    return () => window.removeEventListener('bmad:disconnect', handler)
  }, [nodes, removeConnectedBmad, setCurrentNode])

  return (
    <AddNodeBtn trigger={['contextMenu']}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="light"
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        deleteKeyCode="Delete"
      >
        <Background />
        <MiniMap
          offsetScale={10}
          style={{ height: 120, width: 140, bottom: 36 }}
          position="bottom-left"
          nodeColor={(node) =>
            NODE_COLORS[(node.type ?? 'userInput') as NodeType] ||
            NODE_COLORS.userInput
          }
        />
        <StepLinePanel position="center-left"></StepLinePanel>
        <GroupPanel position="top-center"></GroupPanel>
        <Controls position="bottom-left"></Controls>
        <ToolsPanel position="top-left"></ToolsPanel>
        <EditPanel position="top-right"></EditPanel>
      </ReactFlow>
    </AddNodeBtn>
  )
}
