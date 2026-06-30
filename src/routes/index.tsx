import { createFileRoute } from '@tanstack/react-router'
import '@xyflow/react/dist/style.css'
import { Flow } from '../components/flow'
import styles from './index.module.scss'
import { EditPanel } from '#/components/panel/edit'
import 'antd/dist/antd.css'
import { ConfigProvider, Tabs, theme } from 'antd'
import type { ThemeConfig } from 'antd'
import { ModelManager } from '#/components/model'
import { SkillManager } from '#/components/skill'
import { useRouteStore } from '#/store/route'

export const Route = createFileRoute('/')({ component: App })

const config: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
  },
  algorithm: theme.darkAlgorithm,
}

function App() {
  const activeKey = useRouteStore((state) => state.activeKey)
  const switchTo = useRouteStore((state) => state.switchTo)

  return (
    <ConfigProvider theme={config}>
      <Tabs activeKey={activeKey} onChange={switchTo} tabPosition="left" style={{ height: '100vh' }}>
        <Tabs.TabPane tab="工作流" key="workflow">
          <div className={styles.container}>
            <main className={styles.flow}>
              <Flow />
            </main>
            <EditPanel />
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab="模型管理" key="model">
          <ModelManager />
        </Tabs.TabPane>
        <Tabs.TabPane tab="技能管理" key="skill">
          <SkillManager />
        </Tabs.TabPane>
      </Tabs>
    </ConfigProvider>
  )
}
