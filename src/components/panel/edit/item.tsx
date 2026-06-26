import { InputKinds } from '#/types'
import type { InputKind } from '#/types'
import {
  TextIcon,
  CrumpledPaperIcon,
  FileTextIcon,
  Link1Icon,
  CrossCircledIcon,
} from '@radix-ui/react-icons'
import styles from '../index.module.scss'
import { Button, Input, InputNumber, Typography } from 'antd'
import type { ReactNode } from 'react'

const { Text } = Typography

export interface EditItemProps {
  /** 字段标签 */
  label?: string
  /** 占位符（当使用 kind 时自动派生默认值） */
  placeholder?: string
  /** 输入值 */
  value?: string | number | File
  /** 值变更回调 */
  onChange?: (value: string | number | undefined) => void
  /** 删除回调 */
  onDelete?: () => void
  /** 输入控件类型 */
  inputType?: 'text' | 'textArea' | 'password' | 'number'
  /** 只读 */
  readOnly?: boolean
  /** textArea 行数 */
  rows?: number
  /** number 最小值 */
  min?: number
  /** number 最大值 */
  max?: number
  /** number 步长 */
  step?: number

  // ---- 以下为 InputKinds 兼容模式 ----
  /** 输入种类（兼容旧用法，设置后自动派生 label/placeholder/icon） */
  kind?: InputKind
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

export const EditItem = ({
  label: explicitLabel,
  placeholder: explicitPlaceholder,
  value,
  onChange,
  onDelete,
  inputType = 'text',
  readOnly,
  rows = 3,
  min,
  max,
  step,
  kind,
}: EditItemProps) => {
  // 兼容模式：从 kind 派生 label/placeholder/icon
  const kindMeta = kind ? EditTextMapper.get(kind) : undefined
  const label = explicitLabel ?? kindMeta?.label ?? ''
  const placeholder = explicitPlaceholder ?? kindMeta?.placeholder ?? ''
  const prefix = kindMeta?.icon

  return (
    <div className={styles.line}>
      <div className={styles.line_row}>
        <Text>{label}</Text>
        {onDelete && (
          <Button
            type="text"
            size="small"
            danger
            icon={<CrossCircledIcon />}
            onClick={onDelete}
          />
        )}
      </div>
      {inputType === 'textArea' ? (
        <Input.TextArea
          rows={rows}
          value={value as string}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : inputType === 'password' ? (
        <Input.Password
          prefix={prefix}
          value={value as string}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : inputType === 'number' ? (
        <InputNumber
          style={{ width: '100%' }}
          min={min}
          max={max}
          step={step}
          value={value as number}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(v) => onChange?.(v ?? undefined)}
        />
      ) : (
        <Input
          prefix={prefix}
          value={value as string}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  )
}
