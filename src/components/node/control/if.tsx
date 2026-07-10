import type { NodeProps } from '@xyflow/react'
import type { NIf } from '#/types'
import styles from '../index.module.scss'
import { UNode } from '..'

/**
 * # ifNode：判断节点
 * 用于判断后续应该走哪个路径。
 * ifNode 之后可以有多个 ifConditionNode 分支。
 * 如果 ifNode 被编辑了表达式，则会作为默认判断逻辑。
 */
export const IfNode = (props: NodeProps<NIf>) => {
  return (
    <UNode node={props}>
      {props.data.expression && (
        <div className={styles.row}>
          <span style={{ fontSize: 9, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {props.data.expression}
          </span>
        </div>
      )}
    </UNode>
  )
}
