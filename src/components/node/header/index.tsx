import { NodeIcons } from '#/components/svg'

import type { NodeType } from '#/types'
import styles from '../index.module.scss'

export interface NodeHeaderProps {
  kind: NodeType
  title: string
}

export const NodeHeader = ({ kind, title }: NodeHeaderProps) => {
  const IconComponent = NodeIcons.get(kind)

  return (
    <div className={styles.row} style={{ margin: 0 }}>
      {IconComponent && <IconComponent height={16} width={16} />}
      <h4 className={styles.node_title}>{title}</h4>
    </div>
  )
}
