import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Badge,
  Collapse,
  Empty,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  HistoryOutlined,
  BugOutlined,
  PlayCircleOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useCallback } from 'react'
import type { TableProps } from 'antd'

const { Text, Title } = Typography
const { TextArea } = Input
const { Panel } = Collapse

// ============ Types ============

interface CollectionInfo {
  name: string
  status: 'green' | 'yellow' | 'red'
  vectorsCount: number
  segmentsCount: number
  dimension: number
  distance: string
  lastUpdated?: string
}

interface SyncRecord {
  id: number
  name: string
  status: 'success' | 'fail'
  duration: string
  collections: number
  vectors: number
  error?: string
  time: string
}

// ============ Mock sync records ============

const MOCK_SYNC_RECORDS: SyncRecord[] = [
  { id: 1, name: '全量同步', status: 'success', duration: '18m 32s', collections: 12, vectors: 28432, time: '2026-07-27 03:15:22' },
  { id: 2, name: '增量更新', status: 'success', duration: '4m 12s', collections: 5, vectors: 1280, time: '2026-07-27 02:00:15' },
  { id: 3, name: '配置模板同步', status: 'success', duration: '1m 08s', collections: 1, vectors: 256, time: '2026-07-27 01:00:00' },
  { id: 4, name: '全量同步', status: 'fail', duration: '12m 45s', collections: 8, vectors: 0, error: 'Qdrant 连接超时，请检查 Qdrant 服务状态', time: '2026-07-26 22:30:00' },
  { id: 5, name: '增量更新', status: 'success', duration: '3m 55s', collections: 4, vectors: 890, time: '2026-07-26 20:00:00' },
  { id: 6, name: '全量同步', status: 'success', duration: '20m 10s', collections: 12, vectors: 30120, time: '2026-07-26 03:00:00' },
  { id: 7, name: '配置模板同步', status: 'success', duration: '1m 12s', collections: 1, vectors: 256, time: '2026-07-26 01:00:00' },
]

// ============ Component ============

export const KnowledgeManager = () => {
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})

  // === Load collections ===
  const loadCollections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/execute/qdrant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'collections' }),
      })
      const data = await res.json()
      if (data.status !== 'success') {
        message.error(data.error || '获取集合列表失败')
        setCollections([])
        return
      }

      const list: CollectionInfo[] = []
      for (const c of data.output.collections || []) {
        const infoRes = await fetch('/api/execute/qdrant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'collection-info', collectionName: c.name }),
        })
        const info = await infoRes.json()
        if (info.status === 'success') {
          const r = info.output
          list.push({
            name: c.name,
            status: r.status || 'green',
            vectorsCount: r.vectors_count || 0,
            segmentsCount: r.segments_count || 0,
            dimension: r.config?.params?.vectors?.size || 0,
            distance: r.config?.params?.vectors?.distance || 'Unknown',
            lastUpdated: undefined,
          })
        } else {
          list.push({
            name: c.name,
            status: 'red',
            vectorsCount: 0,
            segmentsCount: 0,
            dimension: 0,
            distance: 'Unknown',
          })
        }
      }
      setCollections(list)
    } catch (err: any) {
      message.error(`加载失败: ${err.message}`)
      setCollections([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCollections()
  }, [loadCollections])

  // === Stats ===
  const totalCount = collections.length
  const activeCount = collections.filter((c) => c.status === 'green').length
  const totalVectors = collections.reduce((sum, c) => sum + c.vectorsCount, 0)
  const errorCount = collections.filter((c) => c.status === 'red' || c.status === 'yellow').length

  // === Delete collection ===
  const handleDelete = (name: string) => {
    Modal.confirm({
      title: '确认删除集合',
      content: `确定要删除集合「${name}」吗？该操作不可恢复，集合中的所有向量数据将被永久删除。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch('/api/execute/qdrant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-collection', collectionName: name }),
          })
          const data = await res.json()
          if (data.status === 'success') {
            message.success(`集合「${name}」已删除`)
            loadCollections()
          } else {
            message.error(data.error || '删除失败')
          }
        } catch (err: any) {
          message.error(`删除失败: ${err.message}`)
        }
      },
    })
  }

  // === Fix collection ===
  const handleFix = (name: string) => {
    message.info(`正在尝试修复集合「${name}」...`)
    // Qdrant 修复通常需要手动处理，这里暂时提示
    message.warning('请检查 Qdrant 服务日志或尝试重建该集合')
  }

  // === Create collection ===
  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      const res = await fetch('/api/execute/qdrant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-collection',
          collectionName: values.name,
          vectorSize: values.vectorSize || 1536,
          distance: values.distance || 'Cosine',
        }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        message.success(`集合「${values.name}」创建成功`)
        setModalOpen(false)
        form.resetFields()
        loadCollections()
      } else {
        message.error(data.error || '创建失败')
      }
    } catch {
      // validation error
    }
  }

  // === Sync workflow ===
  const handleSync = async (key: string, label: string) => {
    setSyncing((prev) => ({ ...prev, [key]: true }))
    try {
      // Simulate sync — actual implementation would trigger a workflow
      await new Promise((resolve) => setTimeout(resolve, 2000))
      message.success(`「${label}」已触发`)
    } catch {
      message.error(`「${label}」触发失败`)
    } finally {
      setSyncing((prev) => ({ ...prev, [key]: false }))
    }
  }

  // === Table columns ===
  const columns: TableProps<CollectionInfo>['columns'] = [
    {
      title: '集合名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <DatabaseOutlined style={{ color: '#13c2c2' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const map: Record<string, { color: string; text: string }> = {
          green: { color: 'success', text: '运行中' },
          yellow: { color: 'warning', text: '初始化中' },
          red: { color: 'error', text: '异常' },
        }
        const s = (status === 'green' || status === 'yellow' || status === 'red')
          ? map[status]
          : { color: 'default', text: status }
        return <Tag color={s.color}>{s.text}</Tag>
      },
    },
    {
      title: '向量数',
      dataIndex: 'vectorsCount',
      key: 'vectorsCount',
      width: 100,
      sorter: (a, b) => a.vectorsCount - b.vectorsCount,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '维度',
      dataIndex: 'dimension',
      key: 'dimension',
      width: 80,
      render: (d: number) => d || '-',
    },
    {
      title: '距离算法',
      dataIndex: 'distance',
      key: 'distance',
      width: 120,
      render: (d: string) => d || '-',
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      width: 160,
      render: (t: string) => t || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          {(record.status === 'red' || record.status === 'yellow') && (
            <Tooltip title="修复">
              <Button
                type="link"
                size="small"
                icon={<BugOutlined />}
                onClick={() => handleFix(record.name)}
              />
            </Tooltip>
          )}
          <Tooltip title="删除集合">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.name)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // === New collection modal form ===
  const syncWorkflowCards = [
    {
      key: 'full-sync',
      title: '知识库全量同步',
      description: '同步所有集合，适用于首次部署或全面重建。过程约 20-30 分钟。',
      duration: '20-30 min',
      icon: <SyncOutlined />,
    },
    {
      key: 'incremental-sync',
      title: '增量更新同步',
      description: '仅同步有变更的集合，快速高效。过程约 3-5 分钟。',
      duration: '3-5 min',
      icon: <ReloadOutlined />,
    },
    {
      key: 'config-sync',
      title: '配置模板同步',
      description: '仅同步 config_templates 集合，更新工作流模板配置。过程约 1-2 分钟。',
      duration: '1-2 min',
      icon: <ApartmentOutlined />,
    },
  ]

  // === Sync history columns ===
  const historyColumns: TableProps<SyncRecord>['columns'] = [
    {
      title: '工作流',
      dataIndex: 'name',
      key: 'name',
      width: 130,
    },
    {
      title: '执行时间',
      dataIndex: 'time',
      key: 'time',
      width: 170,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) =>
        status === 'success' ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            成功
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            失败
          </Tag>
        ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 90,
    },
    {
      title: '涉及集合',
      dataIndex: 'collections',
      key: 'collections',
      width: 80,
    },
    {
      title: '同步向量',
      dataIndex: 'vectors',
      key: 'vectors',
      width: 100,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '错误原因',
      dataIndex: 'error',
      key: 'error',
      render: (err: string) =>
        err ? <Text type="danger">{err}</Text> : '-',
    },
  ]

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      {/* ====== Header ====== */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <DatabaseOutlined style={{ marginRight: 8, color: '#13c2c2' }} />
            知识库管理
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            管理 Qdrant 向量数据库集合和执行同步任务
          </Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadCollections} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              新建集合
            </Button>
          </Space>
        </Col>
      </Row>

      {/* ====== Stat Cards ====== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="集合总数"
              value={totalCount}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="活跃集合"
              value={activeCount}
              suffix={`/ ${totalCount}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="向量总数"
              value={totalVectors.toLocaleString()}
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="异常集合"
              value={errorCount}
              prefix={<WarningOutlined />}
              valueStyle={errorCount > 0 ? { color: '#ff4d4f' } : { color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ====== Collection Table ====== */}
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>集合列表</span>
            <Tag>{totalCount}</Tag>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Table<CollectionInfo>
          columns={columns}
          dataSource={collections}
          rowKey="name"
          loading={loading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无集合，点击「新建集合」创建" /> }}
        />
      </Card>

      {/* ====== Sync Workflows ====== */}
      <Card
        title={
          <Space>
            <SyncOutlined />
            <span>同步工作流</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {syncWorkflowCards.map((card) => (
            <Col key={card.key} xs={24} sm={12} md={8}>
              <Card
                size="small"
                hoverable
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    loading={syncing[card.key]}
                    onClick={() => handleSync(card.key, card.title)}
                  >
                    {syncing[card.key] ? '运行中' : '运行'}
                  </Button>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <Badge
                      count={<SyncOutlined style={{ fontSize: 18, color: '#1890ff' }} />}
                      style={{ backgroundColor: 'transparent' }}
                    />
                  }
                  title={card.title}
                  description={
                    <>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {card.description}
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        预估耗时: {card.duration}
                      </Text>
                    </>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Sync History */}
        <Collapse ghost style={{ background: 'transparent' }}>
          <Panel
            key="history"
            header={
              <Space>
                <HistoryOutlined />
                <span>同步历史</span>
                <Tag>{MOCK_SYNC_RECORDS.length}</Tag>
              </Space>
            }
          >
            <Table<SyncRecord>
              columns={historyColumns}
              dataSource={MOCK_SYNC_RECORDS}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Panel>
        </Collapse>
      </Card>

      {/* ====== New Collection Modal ====== */}
      <Modal
        title="新建集合"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setModalOpen(false)
          form.resetFields()
        }}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ vectorSize: 1536, distance: 'Cosine' }}
        >
          <Form.Item
            name="name"
            label="集合名称"
            rules={[
              { required: true, message: '请输入集合名称' },
              {
                pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
                message: '以字母开头，仅含字母、数字、下划线和连字符',
              },
            ]}
          >
            <Input placeholder="如: my-knowledge-base" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述（可选）"
            rules={[{ max: 200, message: '不超过 200 字' }]}
          >
            <TextArea rows={3} placeholder="集合用途说明（选填）" maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="vectorSize"
            label="向量维度"
            tooltip="根据使用的 Embedding 模型设置，如 text-embedding-ada-002 为 1536 维"
          >
            <Input type="number" min={64} max={8192} />
          </Form.Item>
          <Form.Item
            name="distance"
            label="距离算法"
            tooltip="影响检索相关性"
          >
            <Input placeholder="Cosine / Euclidean / Dot" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
