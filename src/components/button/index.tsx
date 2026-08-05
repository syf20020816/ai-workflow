import { Tooltip, Button } from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'

import type { ButtonProps } from 'antd'
import { useRouteStore } from '#/store/route'

interface EditButtonProps extends ButtonProps {
  kind: 'edit' | 'delete' | 'exec'
  title: string
}

export const EditButton = ({
  kind,
  title,
  onClick,
  ...props
}: EditButtonProps) => {
  const type = () => {
    if (kind === 'exec') return 'primary'
    return 'default'
  }

  const icon = () => {
    if (kind === 'edit') return <EditOutlined />
    if (kind === 'delete') return <DeleteOutlined />
    return <PlayCircleOutlined />
  }

  return (
    <Tooltip title={title}>
      <Button
        danger={kind === 'delete'}
        type={type()}
        icon={icon()}
        onClick={onClick}
        {...props}
      ></Button>
    </Tooltip>
  )
}

export interface ToButtonProps {
  url: string
  children?: React.ReactNode
  isEdit?: boolean
}

EditButton.To = ({ url, children, isEdit = false }: ToButtonProps) => {
  const openInEditor = useRouteStore((s) => s.openInEditor)
  const switchTo = useRouteStore((s) => s.switchTo)
  return (
    <Button
      size="small"
      onClick={() => (isEdit ? openInEditor(url) : switchTo(url))}
    >
      {children ? children : '管理'}
    </Button>
  )
}
