import { useGlobalStore } from '#/store/global'
import { Panel } from '@xyflow/react'
import type { PanelProps } from '@xyflow/react'
import { Segmented } from 'antd'

export const GroupPanel = (props: PanelProps) => {
  const globalMode = useGlobalStore((state) => state.globalMode)
  const setGlobalMode = useGlobalStore((state) => state.setGlobalMode)

  return (
    <Panel {...props}>
      <Segmented
      styles={{root: {backgroundColor: "#3c3c3c"}}}
        size="small"
        shape="round"
        options={[
          { label: '常规', value: 'normal' },
          { label: 'Spec', value: 'spec' },
        ]}
        value={globalMode}
        onChange={(e) => setGlobalMode(e as "spec" | "normal")}
      />
    </Panel>
  )
}
