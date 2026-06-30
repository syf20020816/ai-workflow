import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import type { AppNode } from '#/types'
import { NodeIcons } from '../svg'
import styles from './index.module.scss'
import { Button, Divider, Input, Tabs, Typography } from 'antd'
import type { TabsProps } from 'antd'
import { EditUserInput } from './edit/userInput'
import { EditAgent } from './edit/aiAgent'
import { EditAnswer } from './edit/aiAnswer'
import { EditAIOutput } from './edit/aiOutput'
import { EditBMADAgent } from './edit/bmad'
import { EditLark } from './edit/lark'
import { ExecutionPanel } from '../execution/panel'
import { useState } from 'react'

const { Text } = Typography

type ActiveKey = 'editor' | 'execution'

export const EditPanel = () => {
  const currentNode: AppNode = useNodeStore((state) => state.currentNode)
  const deleteCurrentNode = useNodeStore((state) => state.deleteCurrentNode)
  const [activeKey, setActiveKey] = useState<ActiveKey>('editor')

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
              </main>
              <footer className={styles.footer}>
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
              </footer>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'execution',
      label: '执行',
      children: <ExecutionPanel />,
    },
  ]

  return (
    <div className={styles.panel}>
      <Tabs
        activeKey={activeKey}
        items={items}
        onChange={(k) => setActiveKey(k as ActiveKey)}
        styles={{
          body: { height: '100%' },
          content: { height: '100%' },
          root: { height: '100%' },
        }}
      />
    </div>
  )
}

const EditHeader = () => {
  const currentNode: AppNode = useNodeStore((state) => state.currentNode)
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)

  if (!currentNode) {
    return null
  }

  return (
    <header className={styles.header}>
      <div className={styles.header_title}>
        {NodeIcons.get(currentNode.type) || NodeIcons.get(NodeTypes.USER_INPUT)}
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
