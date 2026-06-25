import { useNodeStore } from '#/store/node'
import { InputKinds } from '#/types'
import type { InputKind, NUserInput } from '#/types'
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

export const EditUserInput = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NUserInput> | null
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)
  const [nodeInput, setNodeInput] = useState<InputKind>('prompt')

  if (!currentNode) {
    return null
  }

  const addInput = () => {
    if (nodeInput === 'prompt') {
      setCurrentNode({
        ...currentNode,
        data: {
          ...currentNode.data,
          input: {
            ...currentNode.data.input,
            prompt: '',
          },
        },
      })
    } else if (nodeInput === 'file') {
      setCurrentNode({
        ...currentNode,
        data: {
          ...currentNode.data,
          input: {
            ...currentNode.data.input,
            files: [],
          },
        },
      })
    } else if (nodeInput === 'url') {
      const urls = currentNode.data.input?.urls || []
      urls.push('')

      setCurrentNode({
        ...currentNode,
        data: {
          ...currentNode.data,
          input: {
            ...currentNode.data.input,
            urls,
          },
        },
      })
    }
  }

  const changeUrl = (index: number, v: string) => {
    if (!currentNode.data.input?.urls) {
      return
    }
    // 更新指定索引的url
    currentNode.data.input.urls[index] = v

    setCurrentNode({
      ...currentNode,
      data: {
        ...currentNode.data,
        input: {
          ...currentNode.data.input,
          urls: currentNode.data.input.urls,
        },
      },
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
        kind={InputKinds.text}
        value={currentNode.data.input?.label}
        onChange={(v?: string | File) => {
          setCurrentNode({
            ...currentNode,
            data: {
              ...currentNode.data,
              input: {
                ...currentNode.data.input,
                label: (v || '') as string,
              },
            },
          })
        }}
      />
      {currentNode.data.input?.prompt !== undefined && (
        <EditItem
          kind={InputKinds.prompt}
          value={currentNode.data.input.prompt}
          onChange={(v?: string | File) => {
            setCurrentNode({
              ...currentNode,
              data: {
                ...currentNode.data,
                input: {
                  ...currentNode.data.input,
                  prompt: (v || '') as string,
                },
              },
            })
          }}
        />
      )}

      {currentNode.data.input?.files?.map((file, index) => (
        <EditItem
          kind={InputKinds.file}
          value={file}
          onChange={(v?: string | File) => {
            setCurrentNode({
              ...currentNode,
              data: {
                ...currentNode.data,
                input: {
                  ...currentNode.data.input,
                  files: [
                    ...(currentNode.data.input?.files || []),
                    (v || '') as File,
                  ],
                },
              },
            })
          }}
        />
      ))}

      {currentNode.data.input?.urls?.map((url, index) => (
        <EditItem
          kind={InputKinds.url}
          value={url}
          onChange={(v?: string | File) => {
            changeUrl(index, v as string)
          }}
        />
      ))}
    </>
  )
}
