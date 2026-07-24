import { useEffect, useState } from 'react'
import { Table, Button, message, Popconfirm, Space, Typography, Tag, Modal, List, Tooltip } from 'antd'
import { DeleteOutlined, ReloadOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons'
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

interface VersionInfo {
  versionId: string
  createdAt: string
  nodeCount: number
  edgeCount: number
}

export const WorkflowManager = () => {
  const setNodes = useNodeStore((state) => state.setNodes)
  const setEdges = useNodeStore((state) => state.setEdges)
  const setWorkflowId = useNodeStore((state) => state.setWorkflowId)
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([])
  const [loading, setLoading] = useState(false)

  // 版本历史
  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const [versionWorkflowId, setVersionWorkflowId] = useState('')
  const [versionWorkflowName, setVersionWorkflowName] = useState('')
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)

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

  // 打开版本历史弹窗
  const openVersionHistory = async (id: string, name: string) => {
    setVersionWorkflowId(id)
    setVersionWorkflowName(name)
    setVersions([])
    setVersionModalOpen(true)
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/workflow/versions?id=${id}`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions || [])
      }
    } catch (err: any) {
      message.error('加载版本历史失败: ' + err.message)
    } finally {
      setVersionsLoading(false)
    }
  }

  // 恢复版本
  const handleRestore = async (versionId: string) => {
    setRestoring(true)
    try {
      const res = await fetch('/api/workflow/versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: versionWorkflowId,
          versionId,
        }),
      })
      if (res.ok) {
        message.success('版本已恢复')
        setVersionModalOpen(false)
        fetchWorkflows()
      } else {
        const data = await res.json()
        message.error('恢复失败: ' + (data.error || '未知错误'))
      }
    } catch (err: any) {
      message.error('恢复失败: ' + err.message)
    } finally {
      setRestoring(false)
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
      width: 180,
      render: (_: any, record: WorkflowMeta) => (
        <Space>
          <Button size="small" type="primary" onClick={() => handleLoad(record.id)}>
            加载
          </Button>
          <Tooltip title="版本历史">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => openVersionHistory(record.id, record.name)}
            />
          </Tooltip>
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

      {/* 版本历史弹窗 */}
      <Modal
        title={`版本历史 - ${versionWorkflowName}`}
        open={versionModalOpen}
        onCancel={() => setVersionModalOpen(false)}
        footer={null}
        width={520}
      >
        {versions.length === 0 && !versionsLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
            <Text type="secondary">暂无版本记录</Text>
          </div>
        ) : (
          <List
            loading={versionsLoading}
            dataSource={versions}
            renderItem={(item: VersionInfo) => (
              <List.Item
                actions={[
                  <Popconfirm
                    key="restore"
                    title="确认恢复"
                    description={`恢复到 ${new Date(item.createdAt).toLocaleString()} 的版本？`}
                    onConfirm={() => handleRestore(item.versionId)}
                  >
                    <Button
                      size="small"
                      icon={<RollbackOutlined />}
                      loading={restoring}
                    >
                      恢复
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Text code style={{ fontSize: 12 }}>
                      {item.versionId}
                    </Text>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                      <Tag style={{ marginLeft: 8, fontSize: 10 }}>
                        {item.nodeCount} 节点
                      </Tag>
                      <Tag style={{ fontSize: 10 }}>{item.edgeCount} 连线</Tag>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}
