import { Icon } from '#/components/svg'
import { NodeTypes } from '#/types'
import type { NodeType } from '#/types'
import styles from '../index.module.scss'

export interface NodeHeaderProps {
  kind: NodeType
  title: string
}

const IconMap: Partial<Record<NodeType, typeof Icon.UserInput>> = {
  [NodeTypes.USER_INPUT]: Icon.UserInput,
  [NodeTypes.AGENT]: Icon.Agent,
  [NodeTypes.AI_OUTPUT]: Icon.AIOutput,
  [NodeTypes.ANSWER]: Icon.Answer,
  [NodeTypes.BMAD_AGENT]: Icon.BMadAgent,
  [NodeTypes.LARK]: Icon.Lark,
}

export const NodeHeader = ({ kind, title }: NodeHeaderProps) => {
  const IconComponent = IconMap[kind]

  return (
    <div className={styles.row}>
      {IconComponent && <IconComponent height={16} width={16} />}
      <h4 className={styles.node_title}>{title}</h4>
    </div>
  )
}
