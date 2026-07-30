import { Tag as AntTag } from 'antd'
import type { TagProps } from 'antd'

export const Tag = (props: TagProps) => {
  return (
    <AntTag
      {...props}
      styles={{
        root: {
          maxWidth: 120,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }}
    >
      {props.children}
    </AntTag>
  )
}
