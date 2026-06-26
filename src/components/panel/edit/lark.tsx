import { useNodeStore } from '#/store/node'
import type { NLark, NLarkData } from '#/types'
import styles from '../index.module.scss'
import { Radio, Typography } from 'antd'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NLarkData

const actionOptions = [
  { label: '读取', value: 'read' },
  { label: '写入', value: 'write' },
  { label: '创建', value: 'create' },
]

export const EditLark = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NLark>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  return (
    <>
      <div className={styles.line}>
        <Text>操作类型</Text>
        <Radio.Group
          options={actionOptions}
          optionType="button"
          buttonStyle="solid"
          value={currentNode.data.action}
          onChange={(e) => {
            patchCurrentNode((draft) => {
              d(draft).action = e.target.value
            })
          }}
        />
      </div>
      <EditItem
        label="文档 URL"
        placeholder="https://xxx.feishu.cn/docx/xxx"
        value={currentNode.data.url}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).url = (v || '') as string
          })
        }}
      />
      {currentNode.data.action === 'write' && (
        <EditItem
          label="写入内容"
          placeholder="要写入文档的内容"
          inputType="textArea"
          rows={4}
          value={currentNode.data.content}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).content = (v || '') as string
            })
          }}
        />
      )}
    </>
  )
}
