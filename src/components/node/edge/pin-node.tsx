import { Button, Tooltip, message } from 'antd'
import { Pin } from 'lucide-react'
import { useNodeStore } from '#/store/node'
import styles from '../index.module.scss'

export interface PinNodeProps {
  nodeId: string
  title: string
}

export const PinNode = ({ nodeId, title }: PinNodeProps) => {
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const pinnedNodes = useNodeStore((state) => state.pinnedNodes)
  const pinNode = useNodeStore((state) => state.pinNode)
  const unpinNode = useNodeStore((state) => state.unpinNode)

  const isPinned = nodeId in pinnedNodes
  const hasOutput = nodeId in pipelineContext.nodeOutputs

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPinned) {
      await unpinNode(nodeId)
      message.success(`已取消固定 ${title}`)
    } else if (hasOutput) {
      await pinNode(nodeId, title)
      message.success(`已固定 ${title} 的输出`)
    } else {
      message.warning('该节点暂无执行结果，请先执行')
    }
  }

  return (
    <Tooltip title={isPinned ? '取消固定' : '固定节点输出（PIN）'}>
      <Button
        size="small"
        type={isPinned ? 'primary' : 'default'}
        className={styles.pin_button}
        styles={{
          root: {
            height: 12,
            width: 12,
            padding: 0,
          },
        }}
        onClick={handlePin}
      >
        <Pin height={8} width={8} fill={isPinned ? 'currentColor' : 'none'} />
      </Button>
    </Tooltip>
  )
}
