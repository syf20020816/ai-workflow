import { useNodeStore } from '#/store/node'
import { Panel } from '@xyflow/react'
import type { PanelProps } from '@xyflow/react'
import { Button, Tooltip } from 'antd'
import { BrushCleaning } from 'lucide-react'

const iconStyle = {
  height: 16,
  width: 16,
}

export interface ToolsPanelProps extends PanelProps {}

export const ToolsPanel = (props: ToolsPanelProps) => {
  const clearPanel = useNodeStore((state) => state.clearPanel)

  const btns = [
    {
      key: 'clearPanel',
      label: '清空面板',
      icon: <BrushCleaning style={iconStyle} />,
    },
  ]

  return (
    <Panel {...props}>
      {btns.map((item) => (
        <Tooltip title={item.label}>
          <Button
            shape="circle"
            icon={item.icon}
            type="default"
            onClick={clearPanel}
          ></Button>
        </Tooltip>
      ))}
    </Panel>
  )
}
