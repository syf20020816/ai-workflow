import type { NodeProps } from '@xyflow/react'
import { InputKinds } from '#/types'
import type { NLark } from '#/types'
import styles from '../../index.module.scss'
import { Tag } from 'antd'
import { UNode } from '../..'
import { InputItem } from '../../user/input'

const actionColorMap: Record<string, string> = {
  read: 'blue',
  write: 'orange',
  create: 'green',
}

const actionLabelMap: Record<string, string> = {
  read: '读取',
  write: '写入',
  create: '创建',
}

/**
 * # Lark 节点
 * 用于与 Lark CLI 进行交互，包含：
 * 1. 通过输入 URL 读取飞书文档内容
 * 2. 通过输入 URL 修改飞书文档内容
 * 3. 创建新飞书文档
 */
export const LarkNode = (props: NodeProps<NLark>) => {
  const hasContent = props.data.action || props.data.url

  return (
    <UNode node={props}>
      {hasContent && (
        <div className={styles.line}>
          {props.data.action && (
            <div className={styles.row}>
              <Tag
                color={actionColorMap[props.data.action]}
                variant="filled"
              >
                {actionLabelMap[props.data.action]}
              </Tag>
            </div>
          )}
          <hr />
          {props.data.url && (
            // <div className={styles.row}>
            //   <span className={styles.row_weak}>{props.data.url}</span>
            // </div>
            <InputItem kind={InputKinds.url} label={props.data.url} />
          )}
        </div>
      )}
    </UNode>
  )
}
