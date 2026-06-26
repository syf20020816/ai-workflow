// 用户输入节点
// 用于获取用户输入的内容

import type { NodeProps } from '@xyflow/react'
import { InputKinds } from '#/types'
import type { InputKind, NUserInput } from '#/types'
import styles from '../index.module.scss'
import { CrumpledPaperIcon, Link1Icon, TextIcon } from '@radix-ui/react-icons'
import type { ReactNode } from 'react'
import { FileTextIcon } from 'lucide-react'
import { UNode } from '..'

/**
 * # 用户输入节点
 * 用于获取用户输入的内容, 输入必须包含**用户的意图文本**，可能包含：
 * 1. 提示词
 * 2. 文件
 * 3. URL 链接
 */
export const UserInputNode = (props: NodeProps<NUserInput>) => {
  const showLines =
    props.data.input?.label ||
    (props.data.input?.files?.length || 0) > 0 ||
    props.data.input?.prompt ||
    (props.data.input?.urls?.length || 0) > 0

  return (
    <UNode  node={props}>
      {showLines && (
        <div className={styles.line}>
          {props.data.input?.label && (
            <InputItem kind={InputKinds.text} label={props.data.input.label} />
          )}
          {props.data.input?.files?.map((file) => (
            <InputItem kind={InputKinds.file} label={file.name} />
          ))}
          {props.data.input?.prompt && (
            <InputItem
              kind={InputKinds.prompt}
              label={props.data.input.prompt}
            />
          )}
          {props.data.input?.urls?.map((url) => (
            <InputItem kind={InputKinds.url} label={url} />
          ))}
        </div>
      )}
    </UNode>
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
      <span className={styles.row_weak}>{label}</span>
    </div>
  )
}
