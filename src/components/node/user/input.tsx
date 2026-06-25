// 用户输入节点
// 用于获取用户输入的内容

import type { NodeProps } from '@xyflow/react'
import { InputKinds } from '#/types'
import type { InputKind, NUserInput } from '#/types'
import styles from '../index.module.scss'
import { useNodeStore } from '#/store/node'
import { Button } from 'antd'
import { Icon } from '../../svg'
import {
  CrumpledPaperIcon,
  Link1Icon,
  PlusCircledIcon,
  TextIcon,
} from '@radix-ui/react-icons'
import type { ReactNode } from 'react'
import { FileTextIcon } from 'lucide-react'

/**
 * # 用户输入节点
 * 用于获取用户输入的内容, 输入必须包含**用户的意图文本**，可能包含：
 * 1. 提示词
 * 2. 文件
 * 3. URL 链接
 */
export const UserInputNode = (props: NodeProps<NUserInput>) => {
  const setCurrentNode = useNodeStore((state) => state.setCurrentNode)

  return (
    <div
      className={styles.node}
      onClick={() => {
        setCurrentNode(props)
      }}
    >
      <div className={styles.row}>
        <Icon.UserInput height={16} width={16} />
        <h4 className={styles.node_title}>{props.data.title}</h4>
      </div>
      <div className={styles.line}>
        {props.data.input?.label && (
          <InputItem kind={InputKinds.text} label={props.data.input.label} />
        )}
        {props.data.input?.files?.map((file) => (
          <InputItem kind={InputKinds.file} label={file.name} />
        ))}
        {props.data.input?.prompt && (
          <InputItem kind={InputKinds.prompt} label={props.data.input.prompt} />
        )}
        {props.data.input?.urls?.map((url) => (
          <InputItem kind={InputKinds.url} label={url} />
        ))}
      </div>

      <Button
        type="primary"
        size="small"
        className={styles.add_button}
        styles={{
          root: {
            height: 16,
            width: 16,
          },
        }}
        icon={<PlusCircledIcon height={10} width={10}></PlusCircledIcon>}
      ></Button>
    </div>
  )
}

export interface InputItemProps {
  kind: InputKind
  label: string
}

const iconAttrs = {
  width: 10,
  height: 10,
  color: '#1890ff',
}

const Icons = new Map<InputKind, ReactNode>([
  [InputKinds.text, <TextIcon {...iconAttrs} />],
  [InputKinds.file, <FileTextIcon {...iconAttrs} />],
  [InputKinds.prompt, <CrumpledPaperIcon {...iconAttrs} />],
  [InputKinds.url, <Link1Icon {...iconAttrs} />],
])

export const InputItem = ({ kind, label }: InputItemProps) => {
  return (
    <div className={styles.row}>
      {Icons.get(kind)}
      <span>{label}</span>
    </div>
  )
}
