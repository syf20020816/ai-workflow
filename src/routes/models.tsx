import { createFileRoute } from '@tanstack/react-router'
import { ConfigProvider, theme } from 'antd'
import type { ThemeConfig } from 'antd'
import { ModelManager } from '#/components/model'
import 'antd/dist/antd.css'

const config: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
  },
  algorithm: theme.darkAlgorithm,
}

export const Route = createFileRoute('/models')({ component: ModelsPage })

function ModelsPage() {
  return (
    <ConfigProvider theme={config}>
      <ModelManager />
    </ConfigProvider>
  )
}
