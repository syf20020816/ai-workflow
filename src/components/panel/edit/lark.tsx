import { useNodeStore } from '#/store/node'
import type { NLark, NLarkData } from '#/types'
import styles from '../index.module.scss'
import { Radio, Typography } from 'antd'
import type { NodeProps } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

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

  const rows: DynEditKVRow[] = [
    {
      key: 'url',
      label: '文档 URL',
      value: currentNode.data.url,
      placeholder: 'https://xxx.feishu.cn/docx/xxx',
    },
  ]

  if (currentNode.data.action === 'write') {
    rows.push({
      key: 'content',
      label: '写入内容',
      value: currentNode.data.content,
      inputType: 'textArea',
      rows: 4,
      placeholder: '要写入文档的内容',
    })
  }

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
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'url') {
              data.url = (value || '') as string
            } else if (key === 'content') {
              data.content = (value || '') as string
            }
          })
        }}
      />
    </>
  )
}
