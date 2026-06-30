import { Button, Tooltip } from 'antd'
import styles from '../index.module.scss'
import { PlayIcon } from '@radix-ui/react-icons'
import { useNodeStore } from '#/store/node'

export interface RunNodeProps {
  nodeId: string
}

export const RunNode = ({ nodeId }: RunNodeProps) => {
  const runFrom = useNodeStore((state) => state.runFrom)
  const pipelineContext = useNodeStore((state) => state.pipelineContext)
  const isRunning =
    pipelineContext.currentNodeId === nodeId &&
    pipelineContext.globalStatus === 'running'

  return (
    <Tooltip title={isRunning ? '执行中...' : '从此节点开始执行'}>
      <Button
        type={isRunning ? 'default' : 'primary'}
        size="small"
        className={styles.run_button}
        loading={isRunning}
        styles={{
          root: {
            height: 12,
            width: 12,
            padding: 0,
          },
        }}
        onClick={(e) => {
          e.stopPropagation()
          runFrom(nodeId)
        }}
      >
        <PlayIcon height={8} width={8}></PlayIcon>
      </Button>
    </Tooltip>
  )
}
