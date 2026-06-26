import type { NodeProps } from '@xyflow/react'
import type { NAgent } from '#/types'
import styles from '../index.module.scss'
import { Badge } from 'antd'
import { UNode } from '../'

/**
 * # 智能体节点
 * 接收输入数据，配置智能体参数
 */
export const AgentNode = (props: NodeProps<NAgent>) => {
  return (
    <UNode node={props}>
        {props.data.modal?.alias && (
        <div className={styles.row}>
          <Badge status="processing" size="small" />
          <span>{props.data.modal.alias}</span>
        </div>
      )}
    </UNode>
  )
}
