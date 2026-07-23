import type { NodeProps } from '@xyflow/react'
import type { NCodeAgent } from '#/types'
import styles from '../index.module.scss'
import { UNode } from '..'

/**
 * # codeAgentNode：代码自主探索节点
 * AI 通过 Tool Calling 自主探索和分析项目代码。
 * 只需配置项目路径和分析指令，AI 会自主决定查看哪些文件。
 */
export const CodeAgentNode = (props: NodeProps<NCodeAgent>) => {
  const projectPath = props.data.projectPath
  const branch = props.data.branch
  const instruction = props.data.instruction
  const maxIterations = props.data.maxIterations ?? 20

  return (
    <UNode node={props}>
      <div className={styles.row}>
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
