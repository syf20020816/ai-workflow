import { useNodeStore } from '#/store/node'
import type { InputKind, NUserInput, NUserInputData } from '#/types'
import { PlusCircledIcon } from '@radix-ui/react-icons'
import styles from '../index.module.scss'
import { Button, Radio } from 'antd'
import type { CheckboxGroupProps } from 'antd/es/checkbox'
import { useState } from 'react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'
import type { NodeProps } from '@xyflow/react'

const options: CheckboxGroupProps<string>['options'] = [
  { label: '提示词', value: 'prompt' },
  { label: '文件', value: 'file' },
  { label: '链接', value: 'url' },
]

/** 在 immer recipe 中快捷获取 NUserInputData 类型的数据 */
const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NUserInputData

export const EditUserInput = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NUserInput>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)
  const [nodeInput, setNodeInput] = useState<InputKind>('prompt')

  const addInput = () => {
    if (nodeInput === 'prompt') {
      patchCurrentNode((draft) => {
        const data = d(draft)
        data.input ??= {}
        data.input.prompt = ''
      })
    } else if (nodeInput === 'file') {
      patchCurrentNode((draft) => {
        const data = d(draft)
        data.input ??= {}
        data.input.files = []
      })
    } else if (nodeInput === 'url') {
      patchCurrentNode((draft) => {
        const data = d(draft)
        data.input ??= {}
        data.input.urls ??= []
        data.input.urls.push('')
      })
    }
  }

  const removeItem = (key: string) => {
    patchCurrentNode((draft) => {
      const data = d(draft)
      data.input ??= {}
      delete (data.input as any)[key]
    })
  }

  const removeFile = (index: number) => {
    patchCurrentNode((draft) => {
      d(draft).input?.files?.splice(index, 1)
    })
  }

  const removeUrl = (index: number) => {
    patchCurrentNode((draft) => {
      d(draft).input?.urls?.splice(index, 1)
    })
  }

  const rows: DynEditKVRow[] = []

  if (currentNode.data.input?.label !== undefined) {
    rows.push({
      key: 'label',
      label: '用户文本输入',
      value: currentNode.data.input.label,
      inputType: 'textArea',
      placeholder: '输入用户文本',
      onDelete: () => removeItem('label'),
    })
  }

  if (currentNode.data.input?.prompt !== undefined) {
    rows.push({
      key: 'prompt',
      label: '提示词',
      value: currentNode.data.input.prompt,
      inputType: 'textArea',
      placeholder: '输入提示词',
      onDelete: () => removeItem('prompt'),
    })
  }

  currentNode.data.input?.files?.forEach((file, index) => {
    rows.push({
      key: `file-${index}`,
      label: `文件 ${index + 1}`,
      value: file,
      placeholder: '上传文件',
      onDelete: () => removeFile(index),
    })
  })

  currentNode.data.input?.urls?.forEach((url, index) => {
    rows.push({
      key: `url-${index}`,
      label: `链接 ${index + 1}`,
      value: url,
      placeholder: '输入链接',
      onDelete: () => removeUrl(index),
    })
  })

  return (
    <>
      <div className={styles.line_row}>
        <Radio.Group
          options={options}
          defaultValue="prompt"
          optionType="button"
          value={nodeInput}
          onChange={(e) => setNodeInput(e.target.value)}
        ></Radio.Group>
        <Button icon={<PlusCircledIcon />} onClick={addInput}></Button>
      </div>
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            data.input ??= {}
            if (key === 'label') {
              data.input.label = (value || '') as string
            } else if (key === 'prompt') {
              data.input.prompt = (value || '') as string
            } else if (key.startsWith('file-')) {
              const index = Number(key.replace('file-', ''))
              if (data.input.files) {
                data.input.files[index] = value as File
              }
            } else if (key.startsWith('url-')) {
              const index = Number(key.replace('url-', ''))
              if (data.input.urls) {
                data.input.urls[index] = (value || '') as string
              }
            }
          })
        }}
      />
    </>
  )
}
