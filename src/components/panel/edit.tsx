import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import type { AppNode } from '#/types'
import { NodeIcons } from '../svg'
import styles from './index.module.scss'
import {
  Button,
  Divider,
  Input,
  Tabs,
  Typography,
  Modal,
  Select,
  message,
} from 'antd'
import type { TabsProps } from 'antd'
import { EditUserInput } from './edit/userInput'
import { EditAgent } from './edit/aiAgent'
import { EditAnswer } from './edit/aiAnswer'
import { EditAIOutput } from './edit/aiOutput'
import { EditBMADAgent } from './edit/bmad'
import { EditLark } from './edit/lark'
import { EditIf } from './edit/if'
import { EditIfCondition } from './edit/ifCondition'
import { EditLoop } from './edit/loop'
import { EditLoopCondition } from './edit/loopCondition'
import { EditRetry } from './edit/retry'
import { EditMemory } from './edit/memory'
import { EditSkill } from './edit/skill'
import { EditCodeAgent } from './edit/codeAgent'
import { EditLarkTemplate } from './edit/larkTemplate'
import { EditKnowledgeRetrieval } from './edit/knowledgeRetrieval'
import { ExecutionPanel } from '../execution/panel'
import { OutputPanel } from '../execution/output'
import { useMemo, useState } from 'react'
import { ExecutionResult } from '../execution/result'
import { Expand, Pin, Shrink } from 'lucide-react'
import { Panel } from '@xyflow/react'
import type { PanelProps } from '@xyflow/react'

const { Text } = Typography

type ActiveKey = 'editor' | 'execution'

export const EditPanel = (props: PanelProps) => {
  const [isShrink, setIsShrink] = useState(false)
  const currentNode: AppNode = useNodeStore((state) => state.currentNode)
  const deleteCurrentNode = useNodeStore((state) => state.deleteCurrentNode)
  const loadPinnedNode = useNodeStore((state) => state.loadPinnedNode)
  const workflowId = useNodeStore((state) => state.workflowId)
  const [activeKey, setActiveKey] = useState<ActiveKey>('editor')
  const [loadOpen, setLoadOpen] = useState(false)
  const [pinnedList, setPinnedList] = useState<
    { nodeId: string; title: string; savedAt: string }[]
  >([])
  const [selectedPin, setSelectedPin] = useState<string | null>(null)

  const items: TabsProps['items'] = [
    {
      key: 'editor',
      label: '编辑',
      children: (
        <div className={styles.editor}>
          {currentNode && (
            <>
              <EditHeader />
              <main style={{ flex: 1, overflow: 'auto' }}>
                <Divider style={{ margin: '12px 0' }} />
                {currentNode.type === NodeTypes.USER_INPUT && <EditUserInput />}
                {currentNode.type === NodeTypes.AGENT && <EditAgent />}
                {currentNode.type === NodeTypes.ANSWER && <EditAnswer />}
                {currentNode.type === NodeTypes.AI_OUTPUT && <EditAIOutput />}
                {currentNode.type === NodeTypes.BMAD_AGENT && <EditBMADAgent />}
                {currentNode.type === NodeTypes.LARK && <EditLark />}
                {currentNode.type === NodeTypes.IF && <EditIf />}
                {currentNode.type === NodeTypes.IF_CONDITION && (
                  <EditIfCondition />
                )}
                {currentNode.type === NodeTypes.LOOP && <EditLoop />}
                {currentNode.type === NodeTypes.LOOP_CONDITION && (
                  <EditLoopCondition />
                )}
                {currentNode.type === NodeTypes.RETRY && <EditRetry />}
                {currentNode.type === NodeTypes.CODE_AGENT && <EditCodeAgent />}
                {currentNode.type === NodeTypes.MEMORY && <EditMemory />}
                {currentNode.type === NodeTypes.SKILL && <EditSkill />}
                {currentNode.type === NodeTypes.LARK_TEMPLATE && (
                  <EditLarkTemplate />
                )}
                {currentNode.type === NodeTypes.KNOWLEDGE_RETRIEVAL && (
                  <EditKnowledgeRetrieval />
                )}
              </main>
              {isShrink && (
                <footer className={styles.footer}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      icon={<Pin size={14} />}
                      block
                      onClick={async () => {
                        const res = await fetch(
                          `/api/workflow/pin?workflowId=${workflowId}`,
                        )
                        const json = await res.json()
                        if (json.status === 'success' && json.data.length > 0) {
                          setPinnedList(json.data)
                          setSelectedPin(null)
                          setLoadOpen(true)
                        } else {
                          message.info(
                            '没有已固定的节点数据，请先执行节点并点击 PIN 按钮',
                          )
                        }
                      }}
                    >
                      加载固定
                    </Button>
                    <Button
                      color="danger"
                      variant="outlined"
                      block
                      onClick={() => {
                        deleteCurrentNode()
                      }}
                    >
                      删除
                    </Button>
                  </div>
                  <Modal
                    title="加载固定节点"
                    open={loadOpen}
                    onCancel={() => setLoadOpen(false)}
                    onOk={async () => {
                      if (!selectedPin) {
                        message.warning('请选择一个固定节点')
                        return
                      }
                      const res = await fetch(
                        `/api/workflow/pin?workflowId=${workflowId}&nodeId=${selectedPin}`,
                      )
                      const json = await res.json()
                      if (json.status === 'success') {
                        loadPinnedNode(selectedPin, json.data.output)
                        message.success(
                          `已加载固定节点: ${json.data.title || selectedPin}`,
                        )
                        setLoadOpen(false)
                      } else {
                        message.error('加载失败')
                      }
                    }}
                  >
                    <Select
                      style={{ width: '100%' }}
                      placeholder="选择要加载的固定节点"
                      value={selectedPin}
                      onChange={setSelectedPin}
                      options={pinnedList.map((p) => ({
                        value: p.nodeId,
                        label: `${p.title} (${p.nodeId})`,
                      }))}
                    />
                  </Modal>
                </footer>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'output',
      label: '输出',
      children: <OutputPanel />,
    },
    {
      key: 'result',
      label: '执行结果',
      children: <ExecutionResult />,
    },
  ]

  return (
    <Panel {...props}>
      <ExecutionPanel />
      <div
        className={styles.panel}
        style={{
          height: isShrink ? '92vh' : '48px',
        }}
      >
        <Tabs
          activeKey={activeKey}
          items={items}
          onChange={(k) => setActiveKey(k as ActiveKey)}
          styles={{
            body: { height: '100%', padding: 0 },
            content: { height: '100%' },
            root: { height: '100%' },
          }}
          tabBarExtraContent={
            <Button
              onClick={() => setIsShrink(!isShrink)}
              type="text"
              icon={
                isShrink ? (
                  <Expand height={16} width={16}></Expand>
                ) : (
                  <Shrink height={16} width={16}></Shrink>
                )
              }
            ></Button>
          }
        />
      </div>
    </Panel>
  )
}

const EditHeader = () => {
  const currentNode: AppNode = useNodeStore((state) => state.currentNode)
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)
  const IconComponent = useMemo(() => {
    if (!currentNode) return null;
  return  NodeIcons.get(currentNode.type) || NodeIcons.get(NodeTypes.USER_INPUT)
  }, [currentNode])
  if (!currentNode) {
    return null
  }

  return (
    <header className={styles.header}>
      <div className={styles.header_title}>
        {IconComponent && <IconComponent height={24} width={24}></IconComponent>}
        <Input
          value={currentNode.data.title}
          className={styles.header_title_input}
          onChange={(e) => {
            setCurrentNode({
              ...currentNode,
              data: {
                ...currentNode.data,
                title: e.target.value,
              },
            })
          }}
        ></Input>
      </div>
      <div className={styles.line}>
        <Text>描述</Text>
        <Input
          className={styles.description_input}
          value={currentNode.data.description}
          onChange={(e) => {
            setCurrentNode({
              ...currentNode,
              data: {
                ...currentNode.data,
                description: e.target.value,
              },
            })
          }}
        ></Input>
      </div>
    </header>
  )
}
