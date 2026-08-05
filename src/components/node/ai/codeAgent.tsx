import type { NodeProps } from '@xyflow/react'
import type { NCodeAgent } from '#/types'
import styles from '../index.module.scss'
import { UNode } from '..'
import { Tag } from '#/components/tag'

/**
 * # codeAgentNode：代码自主探索节点
 * AI 通过 Tool Calling 自主探索和分析项目代码。
 * 只需配置项目路径和分析指令，AI 会自主决定查看哪些文件。
 * mode = batch 时按 tasks.md 批次实现代码。
 */
export const CodeAgentNode = (props: NodeProps<NCodeAgent>) => {
  const projectPath = props.data.projectPath
  const branch = props.data.branch
  const instruction = props.data.instruction
  const maxIterations = props.data.maxIterations ?? 20
  const mode = props.data.mode ?? 'analyze'
  const completedBatches = props.data.completedBatches
  const totalBatches = props.data.totalBatches

  return (
    <UNode node={props}>
      <div className={styles.row}>
        {mode === 'batch' ? (
          <Tag color="purple">batch</Tag>
        ) : (
          <Tag>analyze</Tag>
        )}
        {totalBatches != null && completedBatches != null && (
          <Tag color="blue">
            {completedBatches.length}/{totalBatches} Batch
          </Tag>
        )}
        <span style={{ fontSize: 9, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#888' }}>
          最大迭代: {maxIterations}
        </span>
      </div>
      {projectPath && (
        <div className={styles.row}>
          <span style={{ fontSize: 9, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {branch ? `[${branch}] ` : ''}{projectPath}
          </span>
        </div>
      )}
      {instruction && (
        <div className={styles.row}>
          <span style={{ fontSize: 9, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#666' }}>
            {instruction}
          </span>
        </div>
      )}
    </UNode>
  )
}
