import { useNodeStore } from '#/store/node'
import { NodeTypes } from '#/types'
import type { AppNode } from '#/types'
import { NodeIcons } from '../svg'
import styles from './index.module.scss'
import { Divider, Input, Typography } from 'antd'
import { EditUserInput } from './edit/userInput'

const { Text } = Typography

export const EditPanel = () => {
  const currentNode: AppNode = useNodeStore((state) => state.currentNode)
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)

  if (!currentNode) {
    return null
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.header_title}>
          {NodeIcons.get(currentNode.type) ||
            NodeIcons.get(NodeTypes.USER_INPUT)}
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
      <Divider style={{ margin: '12px 0' }}></Divider>
      <main>
        {currentNode.type === NodeTypes.USER_INPUT && <EditUserInput />}
      </main>
    </div>
  )
}
