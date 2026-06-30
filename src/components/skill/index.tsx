import { useBmadAgentStore } from '#/store/bmad'
import { Table, Tag, Space, Typography, Button } from 'antd'
import { useEffect } from 'react'
import { ReloadIcon } from '@radix-ui/react-icons'

const { Text } = Typography

const moduleColorMap: Record<string, string> = {
  bmm: 'blue',
  bmb: 'green',
  tea: 'orange',
}

export const SkillManager = () => {
  const agents = useBmadAgentStore((state) => state.agents)
  const loading = useBmadAgentStore((state) => state.loading)
  const fetchAgents = useBmadAgentStore((state) => state.fetchAgents)

  useEffect(() => {
    fetchAgents()
  }, [])

  const columns = [
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 50,
      render: (icon: string) => <span style={{ fontSize: 20 }}>{icon}</span>,
    },
    {
      title: '角色',
      dataIndex: 'title',
      key: 'title',
      width: 160,
      render: (title: string, record: any) => (
        <Space>
          <Tag color={moduleColorMap[record.module]}>{record.module.toUpperCase()}</Tag>
          <span>{title}</span>
        </Space>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '团队',
      dataIndex: 'team',
      key: 'team',
      width: 140,
      render: (team: string) => team.replace('-', ' '),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>BMad 角色管理</h2>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          角色数据来源于 BMad 配置文件 (<code>bmad/_bmad/config.toml</code>)，需修改请编辑该文件或
          <code>bmad/_bmad/custom/config.toml</code>。
        </Text>
        <Button size="small" icon={<ReloadIcon />} onClick={fetchAgents} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        dataSource={agents}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
      />
    </div>
  )
}
