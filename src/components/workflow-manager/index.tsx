import { useEffect, useState } from 'react'
import { Table, Button, message, Popconfirm, Space, Typography, Tag } from 'antd'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNodeStore } from '#/store/node'

const { Text } = Typography

interface WorkflowMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  nodeCount: number
  edgeCount: number
}

export const WorkflowManager = () => {
  const setNodes = useNodeStore((state) => state.setNodes)
  const setEdges = useNodeStore((state) => state.setEdges)
  const setWorkflowId = useNodeStore((state) => state.setWorkflowId)
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([])
  const [loading, setLoading] = useState(false)

  const fetchWorkflows = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workflows')
      const data = await res.json()
      setWorkflows(data)
    } catch (err: any) {
      message.error('加载工作流失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkflows()
  }, [])

  const handleLoad = async (id: string) => {
    try {
      const res = await fetch(`/workflows/${id}.json`)
      if (!res.ok) {
        message.error('加载工作流文件失败')
        return
      }
      const data = await res.json()
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
      setWorkflowId(data.id || id)
      message.success(`已加载工作流: ${data.name}`)
    } catch (err: any) {
      message.error('加载失败: ' + err.message)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        message.success('已删除')
        fetchWorkflows()
      }
    } catch (err: any) {
      message.error('删除失败: ' + err.message)
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '节点数',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
      width: 80,
      align: 'center' as const,
      render: (count: number) => <Tag>{count}</Tag>,
    },
    {
      title: '连线数',
      dataIndex: 'edgeCount',
      key: 'edgeCount',
      width: 80,
      align: 'center' as const,
      render: (count: number) => <Tag>{count}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {date ? new Date(date).toLocaleString() : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: WorkflowMeta) => (
        <Space>
          <Button size="small" type="primary" onClick={() => handleLoad(record.id)}>
            加载
          </Button>
          <Popconfirm
            title="确认删除"
            description={`删除工作流 "${record.name}"？`}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, margin: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 18 }}>
          工作流管理
        </Text>
        <Button icon={<ReloadOutlined />} onClick={fetchWorkflows} loading={loading}>
          刷新
        </Button>
      </div>
      {workflows.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>
          <Text type="secondary">暂无保存的工作流模板</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            在工作流编排页面 → 执行面板 → 点击「保存工作流模板」进行保存
          </Text>
        </div>
      ) : (
        <Table
          dataSource={workflows}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10 }}
        />
      )}
    </div>
  )
}
