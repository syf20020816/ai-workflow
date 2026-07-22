import type { NodeProps } from '@xyflow/react'
import type { NMemory } from '#/types'
import styles from '../index.module.scss'
import { UNode } from '..'

/**
 * MemoryNode：记忆节点
 * 读取 memory/memory.md 文件内容并传递到下游。
 * 可在「规则与记忆」页面编辑记忆内容。
 */
export const MemoryNode = (props: NodeProps<NMemory>) => {
  const memoryPath = props.data.memoryPath || 'memory/memory.md'

  return (
    <UNode node={props}>
      <div className={styles.row}>
        <span style={{ fontSize: 9, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#888' }}>
          {memoryPath}
        </span>
      </div>
    </UNode>
  )
}
