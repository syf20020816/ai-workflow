import { createFileRoute } from '@tanstack/react-router'
import '@xyflow/react/dist/style.css'
import { Flow } from '../components/flow'
import styles from './index.module.scss'
import 'antd/dist/antd.css'
import { ConfigProvider, Menu, Layout, theme, Tooltip } from 'antd'
import type { ThemeConfig } from 'antd'
import { PromptManager } from '#/components/rule'
import { KnowledgeManager } from '#/components/knowledge'
import { ExecutionHistory } from '#/components/execution/history'
import { FileEditor } from '#/components/file-editor'
import { Logo } from '#/components/logo'
import { useRouteStore } from '#/store/route'
import { Cable, FileCode, Bot, Database, PanelLeftClose, PanelLeftOpen, History } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/')({ component: App })

const config: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
  },
  algorithm: theme.darkAlgorithm,
}

const { Sider, Content } = Layout

function App() {
  const activeKey = useRouteStore((state) => state.activeKey)
  const switchTo = useRouteStore((state) => state.switchTo)
  const [collapsed, setCollapsed] = useState(false)

  const baseMenuItems = [
    { label: '工作流编排', key: 'workflow', icon: <Cable size={16} /> },
    { label: '规则与模型', key: 'prompts', icon: <Bot size={16} /> },
    { label: '知识库', key: 'knowledge', icon: <Database size={16} /> },
    { label: '执行历史', key: 'history', icon: <History size={16} /> },
    { label: '编辑器', key: 'editor', icon: <FileCode size={16} /> },
  ]

  const menuItems = collapsed
    ? baseMenuItems.map((item) => ({
        ...item,
        label: (
          <Tooltip title={item.label} placement="right">
            <span>{item.label}</span>
          </Tooltip>
        ),
      }))
    : baseMenuItems

  return (
    <ConfigProvider theme={config}>
      <Layout style={{ height: '100vh' }}>
        <Sider
          width={160}
          collapsedWidth={56}
          collapsed={collapsed}
          className={styles.sider}
          trigger={null}
        >
          <div className={styles.header}>
            {collapsed ? (
              <Logo size={24} letters={['P']} />
            ) : (
              <Logo size={20} />
            )}
          </div>
          <Menu
            onClick={({ key }) => switchTo(key)}
            selectedKeys={[activeKey]}
            mode="vertical"
            items={menuItems}
            style={{ borderInlineEnd: 'none', background: 'transparent' }}
          />
          <div
            className={styles.trigger}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </div>
        </Sider>
        <Content style={{ overflow: 'auto' }}>
          {activeKey === 'workflow' && (
            <div className={styles.container}>
              <main className={styles.flow}>
                <Flow />
              </main>
            </div>
          )}
          {activeKey === 'prompts' && <PromptManager />}
          {activeKey === 'knowledge' && <KnowledgeManager />}
          {activeKey === 'history' && (
            <div style={{ padding: 24 }}>
              <ExecutionHistory />
            </div>
          )}
          {activeKey === 'editor' && <FileEditor />}
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
