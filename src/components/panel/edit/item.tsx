import { InputKinds } from '#/types'
import type { InputKind } from '#/types'
import {
  TextIcon,
  CrumpledPaperIcon,
  FileTextIcon,
  Link1Icon,
} from '@radix-ui/react-icons'
import styles from '../index.module.scss'
import { Input, Typography } from 'antd'
import type { ReactNode } from 'react'

const { Text } = Typography

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

export const EditItem = ({ kind, value, onChange }: EditItemProps) => {
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
