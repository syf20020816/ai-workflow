import { Panel } from '@xyflow/react'
import type { PanelProps } from '@xyflow/react'
import { Sender } from '@ant-design/x'
import { useState } from 'react'
import styles from '../index.module.scss'
import { Flex } from 'antd'
import { ModelSelect } from '#/components/select'

export const SenderPanel = (props: PanelProps) => {
  const [loading, setLoading] = useState(false)
  const [value, setValue] = useState('')
  const [selectedModel, setSelectedModel] = useState('')

  return (
    <Panel {...props}>
      <div className={styles.senderPanel}>
        <Sender
          styles={{
            root: {
              backgroundColor: 'var(--xy-node-background-color)',
            },
          }}
          suffix={false}
          loading={loading}
          value={value}
          onChange={(v) => {
            setValue(v)
          }}
          onSubmit={() => {
            setValue('')
            setLoading(true)
          }}
          onCancel={() => {
            setLoading(false)
          }}
          autoSize={{ minRows: 1, maxRows: 3 }}
          footer={(_, { components }) => {
            const { SendButton, LoadingButton } = components

            return (
              <Flex justify="space-between" align="center">
                <ModelSelect
                  style={{ width: 200 }}
                  value={selectedModel}
                  onChange={(v) => setSelectedModel(v)}
                />

                {loading ? (
                  <LoadingButton type="default" />
                ) : (
                  <SendButton type="primary" disabled={false} />
                )}
              </Flex>
            )
          }}
        />
      </div>
    </Panel>
  )
}
