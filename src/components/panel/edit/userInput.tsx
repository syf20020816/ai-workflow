import { useNodeStore } from '#/store/node'
import { InputKinds } from '#/types'
import type { InputKind, NUserInput, NUserInputData } from '#/types'
import { PlusCircledIcon } from '@radix-ui/react-icons'
import styles from '../index.module.scss'
import { Button, Radio } from 'antd'
import type { CheckboxGroupProps } from 'antd/es/checkbox'
import { useState } from 'react'
import { EditItem } from './item'
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
      <EditItem
        inputType="textArea"
        kind={InputKinds.text}
        value={currentNode.data.input?.label}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            data.input ??= {}
            data.input.label = (v || '') as string
          })
        }}
        onDelete={() => removeItem('label')}
      />
      {currentNode.data.input?.prompt !== undefined && (
        <EditItem
          kind={InputKinds.prompt}
          value={currentNode.data.input.prompt}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              const data = d(draft)
              data.input ??= {}
              data.input.prompt = (v || '') as string
            })
          }}
          onDelete={() => removeItem('prompt')}
        />
      )}

      {currentNode.data.input?.files?.map((file, index) => (
        <EditItem
          kind={InputKinds.file}
          value={file}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              const data = d(draft)
              if (!data.input?.files) return
              data.input.files[index] = (v || '') as File
            })
          }}
          onDelete={() => removeFile(index)}
        />
      ))}

      {currentNode.data.input?.urls?.map((url, index) => (
        <EditItem
          kind={InputKinds.url}
          value={url}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              const data = d(draft)
              if (!data.input?.urls) return
              data.input.urls[index] = (v || '') as string
            })
          }}
          onDelete={() => removeUrl(index)}
        />
      ))}
    </>
  )
}
