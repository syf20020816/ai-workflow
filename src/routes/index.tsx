import { createFileRoute } from '@tanstack/react-router'
import '@xyflow/react/dist/style.css'
import { Flow } from '../components/flow'
import styles from './index.module.scss'
import { EditPanel } from '#/components/panel/edit'
import 'antd/dist/antd.css'
import { ConfigProvider, theme } from 'antd'
import type { ThemeConfig } from 'antd'

export const Route = createFileRoute('/')({ component: App })

const config: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
  },
  algorithm: theme.darkAlgorithm,
}

function App() {
  return (
    <ConfigProvider theme={config}>
      <div className={styles.container}>
        <main className={styles.flow}>
          <Flow />
        </main>
        <EditPanel />
      </div>
    </ConfigProvider>
  )
}
