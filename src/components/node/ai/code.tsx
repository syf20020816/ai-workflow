import type { NodeProps } from '@xyflow/react'
import type { NCode } from '#/types'
import styles from '../index.module.scss'
import { Tag } from 'antd'
import { UNode } from '..'

/**
 * # codeNode：代码访问节点
 * 访问用户提供的代码进行分析。
 * 必须连接在 AgentNode 或 BMadNode 之后。
 * 支持本地和云端两种模式。
 */
export const CodeNode = (props: NodeProps<NCode>) => {
  const modeLabel = props.data.mode === 'cloud' ? '云端' : '本地'
  const modeColor = props.data.mode === 'cloud' ? 'green' : 'blue'

  return (
    <UNode node={props}>
      <div className={styles.row}>
        <Tag color={modeColor} style={{ fontSize: 9, margin: 0 }}>
          {modeLabel}
        </Tag>
        <span style={{ fontSize: 9, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {props.data.branch || 'master'}
        </span>
      </div>
      {props.data.repoUrl && (
        <div className={styles.row}>
          <span style={{ fontSize: 9, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {props.data.repoUrl}
          </span>
        </div>
      )}
    </UNode>
  )
}
