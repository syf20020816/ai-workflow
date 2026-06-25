import { useNodeStore } from '#/store/node'
import { InputKinds, NodeTypes } from '#/types'
import type { AppNode, InputKind, NodeType } from '#/types'
import {
  PlusCircledIcon,
  TextIcon,
  CrumpledPaperIcon,
  FileTextIcon,
  Link1Icon,
} from '@radix-ui/react-icons'
import { NodeIcons } from '../svg'
import styles from './index.module.scss'
import { Button, Divider, Input, Radio, Typography } from 'antd'
import type { CheckboxGroupProps } from 'antd/es/checkbox'
import { useState } from 'react'
import type { ReactNode } from 'react'

const { Text } = Typography

const options: CheckboxGroupProps<string>['options'] = [
  { label: '提示词', value: 'prompt' },
  { label: '文件', value: 'file' },
  { label: '链接', value: 'url' },
]

export const EditPanel = () => {
  const currentNode: AppNode = useNodeStore((state) => state.currentNode)
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)
  const [nodeInput, setNodeInput] = useState<InputKind>('prompt')

  const addInput = () => {
    if (!currentNode) {
      return
    }
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
        {currentNode.type === NodeTypes.USER_INPUT && (
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
                  setCurrentNode({
                    ...currentNode,
                    data: {
                      ...currentNode.data,
                      input: {
                        ...currentNode.data.input,
                        urls: [
                          ...(currentNode.data.input?.urls || []),
                          (v || '') as string,
                        ],
                      },
                    },
                  })
                }}
              />
            ))}
          </>
        )}
      </main>
    </div>
  )
}

export interface EditItemProps {
  kind: InputKind
  value?: string | File
  onChange: (value?: string | File) => void
}

const iconAttrs = {
  width: 12,
  height: 12,
  color: '#1890ff',
}

const EditTextMapper = new Map<
  InputKind,
  {
    label: string
    placeholder: string
    icon: ReactNode
  }
>([
  [
    InputKinds.text,
    {
      label: '用户文本输入',
      placeholder: '输入用户文本',
      icon: <TextIcon {...iconAttrs} />,
    },
  ],
  [
    InputKinds.prompt,
    {
      label: '提示词',
      placeholder: '输入提示词',
      icon: <CrumpledPaperIcon {...iconAttrs} />,
    },
  ],
  [
    InputKinds.file,
    {
      label: '文件',
      placeholder: '上传文件',
      icon: <FileTextIcon {...iconAttrs} />,
    },
  ],
  [
    InputKinds.url,
    {
      label: '链接',
      placeholder: '输入链接',
      icon: <Link1Icon {...iconAttrs} />,
    },
  ],
])

const EditItem = ({ kind, value, onChange }: EditItemProps) => {
  const { label, placeholder, icon } = EditTextMapper.get(kind) || {}

  return (
    <div className={styles.line}>
      <Text>{label}</Text>
      <Input
        prefix={icon}
        value={value as string}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      ></Input>
    </div>
  )
}
