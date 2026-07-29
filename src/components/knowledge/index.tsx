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
  Collapse,
  Empty,
  Tabs,
  Upload,
  Select,
  List,
  Progress,
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
  FileTextOutlined,
  InboxOutlined,
  LoadingOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useCallback } from 'react'
import type { TableProps } from 'antd'
import { VectorGraph } from './VectorGraph'

const { Text, Title } = Typography
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
  {
    id: 1,
    name: '全量同步',
    status: 'success',
    duration: '18m 32s',
    collections: 12,
    vectors: 28432,
    time: '2026-07-27 03:15:22',
  },
  {
    id: 2,
    name: '增量更新',
    status: 'success',
    duration: '4m 12s',
    collections: 5,
    vectors: 1280,
    time: '2026-07-27 02:00:15',
  },
  {
    id: 3,
    name: '配置模板同步',
    status: 'success',
    duration: '1m 08s',
    collections: 1,
    vectors: 256,
    time: '2026-07-27 01:00:00',
  },
  {
    id: 4,
    name: '全量同步',
    status: 'fail',
    duration: '12m 45s',
    collections: 8,
    vectors: 0,
    error: 'Qdrant 连接超时，请检查 Qdrant 服务状态',
    time: '2026-07-26 22:30:00',
  },
  {
    id: 5,
    name: '增量更新',
    status: 'success',
    duration: '3m 55s',
    collections: 4,
    vectors: 890,
    time: '2026-07-26 20:00:00',
  },
  {
    id: 6,
    name: '全量同步',
    status: 'success',
    duration: '20m 10s',
    collections: 12,
    vectors: 30120,
    time: '2026-07-26 03:00:00',
  },
  {
    id: 7,
    name: '配置模板同步',
    status: 'success',
    duration: '1m 12s',
    collections: 1,
    vectors: 256,
    time: '2026-07-26 01:00:00',
  },
]

// ============ Component ============

export const KnowledgeManager = () => {
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  // === Document upload state ===
  interface DocRecord {
    id: string
    fileName: string
    collectionName: string
    totalChunks: number
    totalVectors: number
    status: 'processing' | 'success' | 'error'
    error?: string
    createdAt: string
  }
  const [docs, setDocs] = useState<DocRecord[]>([])
  const [uploadCollection, setUploadCollection] = useState<string>('')
  const [embedModelId, setEmbedModelId] = useState<string>('')
  const [modelList, setModelList] = useState<
    Array<{ id: string; name: string; modelName: string }>
  >([])

  // === Visualization state ===
  const [visualizeCollection, setVisualizeCollection] = useState<string>('')
  const [activeTab, setActiveTab] = useState<string>('collections')

  // === Sync workflow state ===
  interface SyncWorkflowItem {
    id: string
    name: string
    nodeCount: number
    updatedAt: string
  }
  const [syncWorkflows, setSyncWorkflows] = useState<SyncWorkflowItem[]>([])
  const [syncLoading, setSyncLoading] = useState(false)
  const [runningSyncId, setRunningSyncId] = useState<string | null>(null)

  // === Handle file upload and processing ===
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

  const handleProcessDoc = async (file: File, collectionName: string) => {
    // 前端文件大小校验
    if (file.size > MAX_FILE_SIZE) {
      message.warning(
        `「${file.name}」文件过大 (${(file.size / 1024 / 1024).toFixed(1)} MB)，请上传 5 MB 以内的文件`,
      )
      return
    }

    const docId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setDocs((prev) => [
      {
        id: docId,
        fileName: file.name,
        collectionName,
        totalChunks: 0,
        totalVectors: 0,
        status: 'processing',
        createdAt: new Date().toLocaleString(),
      },
      ...prev,
    ])

    try {
      const text = await file.text()
      const res = await fetch('/api/execute/doc-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName,
          content: text,
          fileName: file.name,
          modelId: embedModelId || undefined,
        }),
      })
      const data = await res.json()

      if (data.status === 'success') {
        setDocs((prev) =>
          prev.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  status: 'success',
                  totalChunks: data.output.totalChunks,
                  totalVectors: data.output.totalVectors,
                }
              : d,
          ),
        )
        message.success(
          `「${file.name}」处理完成，共 ${data.output.totalChunks} 个块`,
        )
        loadCollections() // 刷新集合统计
      } else {
        setDocs((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, status: 'error', error: data.error } : d,
          ),
        )
        message.error(`「${file.name}」处理失败: ${data.error}`)
      }
    } catch (err: any) {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, status: 'error', error: err.message } : d,
        ),
      )
      message.error(`「${file.name}」处理失败: ${err.message}`)
    }
  }

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
          body: JSON.stringify({
            action: 'collection-info',
            collectionName: c.name,
          }),
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

  // === Load model list ===
  const loadModels = useCallback(async () => {
    try {
      const res = await fetch('/api/execute/models')
      const data = await res.json()
      if (data.status === 'success') {
        setModelList(data.output?.models || [])
      }
    } catch {
      setModelList([])
    }
  }, [])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  // === Qdrant connection status ===
  type QdrantStatus = 'checking' | 'connected' | 'disconnected'
  const [qdrantStatus, setQdrantStatus] = useState<QdrantStatus>('checking')

  const checkQdrantConnection = useCallback(async () => {
    setQdrantStatus('checking')
    try {
      const res = await fetch('/api/execute/qdrant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'collections' }),
      })
      const data = await res.json()
      setQdrantStatus(data.status === 'success' ? 'connected' : 'disconnected')
    } catch {
      setQdrantStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    checkQdrantConnection()
  }, [checkQdrantConnection])

  // === Load sync workflows (filtered by knowledgeStore node) ===
  const loadSyncWorkflows = useCallback(async () => {
    setSyncLoading(true)
    try {
      const res = await fetch('/api/workflows')
      const data = await res.json()
      if (Array.isArray(data)) {
        const filtered = data
          .filter((wf: any) => wf.hasKnowledgeStore)
          .map((wf: any) => ({
            id: wf.id,
            name: wf.name,
            nodeCount: wf.nodeCount,
            updatedAt: wf.updatedAt,
          }))
        setSyncWorkflows(filtered)
      }
    } catch {
      setSyncWorkflows([])
    } finally {
      setSyncLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSyncWorkflows()
  }, [loadSyncWorkflows])

  // === Stats ===
  const totalCount = collections.length
  const activeCount = collections.filter((c) => c.status === 'green').length
  const totalVectors = collections.reduce((sum, c) => sum + c.vectorsCount, 0)
  const errorCount = collections.filter(
    (c) => c.status === 'red' || c.status === 'yellow',
  ).length

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
            body: JSON.stringify({
              action: 'delete-collection',
              collectionName: name,
            }),
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

  // === Sync workflow actions ===
  const handleRunSync = async (id: string) => {
    setRunningSyncId(id)
    try {
      const res = await fetch(`/api/workflows?id=${encodeURIComponent(id)}`)
      if (!res.ok) {
        message.error('无法获取工作流数据')
        return
      }
      const data = await res.json()
      if (!data.nodes || !data.edges) {
        message.error('工作流数据不完整')
        return
      }
      // 加载到编辑器并执行
      const { useNodeStore } = await import('#/store/node')
      const store = useNodeStore.getState()
      store.setWorkflowId(data.id || id)
      store.setNodes(data.nodes)
      store.setEdges(data.edges)
      store.runAll()
      message.success(`「${data.name || id}」已开始执行`)
    } catch (err: any) {
      message.error(`运行失败: ${err.message}`)
    } finally {
      setRunningSyncId(null)
    }
  }

  const handleEditSync = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows?id=${encodeURIComponent(id)}`)
      if (!res.ok) {
        message.error('无法获取工作流数据')
        return
      }
      const data = await res.json()
      if (!data.nodes || !data.edges) {
        message.error('工作流数据不完整')
        return
      }
      // 加载到编辑器并切换到工作流 tab
      const { useNodeStore } = await import('#/store/node')
      const { useRouteStore } = await import('#/store/route')
      const store = useNodeStore.getState()
      store.setWorkflowId(data.id || id)
      store.setNodes(data.nodes)
      store.setEdges(data.edges)
      useRouteStore.getState().switchTo('workflow')
      message.success(`已加载「${data.name || id}」到编辑器`)
    } catch (err: any) {
      message.error(`加载失败: ${err.message}`)
    }
  }

  const handleDeleteSync = (id: string, name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除同步工作流「${name}」吗？`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(
            `/api/workflows?id=${encodeURIComponent(id)}`,
            { method: 'DELETE' },
          )
          const data = await res.json()
          if (data.success) {
            message.success(`「${name}」已删除`)
            loadSyncWorkflows()
          } else {
            message.error(data.error || '删除失败')
          }
        } catch (err: any) {
          message.error(`删除失败: ${err.message}`)
        }
      },
    })
  }

  // === Table columns ===
  const columns: TableProps<CollectionInfo>['columns'] = [
    {
      title: '集合名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
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
        const s =
          status === 'green' || status === 'yellow' || status === 'red'
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
      width: 200,
      render: (t: string) => t || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <Space>
          <Tooltip title="可视化">
            <Button
              type="link"
              icon={<ApartmentOutlined />}
              onClick={() => {
                setVisualizeCollection(record.name)
                setActiveTab('visualize')
              }}
            />
          </Tooltip>
          {(record.status === 'red' || record.status === 'yellow') && (
            <Tooltip title="修复">
              <Button
                type="link"
                icon={<BugOutlined />}
                onClick={() => handleFix(record.name)}
              />
            </Tooltip>
          )}
          <Tooltip title="删除集合">
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.name)}
            />
          </Tooltip>
        </Space>
      ),
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
      render: (err: string) => (err ? <Text type="danger">{err}</Text> : '-'),
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
            管理 Qdrant 向量数据库集合、上传文档并自动向量化
          </Text>
        </Col>
        <Col>
          <Space>
            {/* Qdrant 连接状态 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {qdrantStatus === 'checking' ? (
                <>
                  <LoadingOutlined style={{ color: '#faad14', fontSize: 14 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>正在检测连接...</Text>
                </>
              ) : (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: qdrantStatus === 'connected' ? '#52c41a' : '#ff4d4f',
                      boxShadow: qdrantStatus === 'connected'
                        ? '0 0 0 0 rgba(82, 196, 26, 0.6)'
                        : 'none',
                      animation: qdrantStatus === 'connected'
                        ? 'qdrantPulse 1.5s ease-in-out infinite'
                        : 'none',
                    }}
                  />
                  <Text style={{ fontSize: 12, color: qdrantStatus === 'connected' ? '#52c41a' : '#ff4d4f' }}>
                    Qdrant {qdrantStatus === 'connected' ? '已连接' : '未连接'}
                  </Text>
                  {qdrantStatus === 'disconnected' && (
                    <Button size="small" icon={<ReloadOutlined />} onClick={checkQdrantConnection}>
                      测试连接
                    </Button>
                  )}
                </>
              )}
            </div>
          </Space>
        </Col>
      </Row>

      {/* Qdrant pulse keyframes */}
      <style>{`
        @keyframes qdrantPulse {
          0% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.6); }
          70% { box-shadow: 0 0 0 6px rgba(82, 196, 26, 0); }
          100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
        }
      `}</style>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          // ===== Tab 1: 集合管理 =====
          {
            key: 'collections',
            label: (
              <Space>
                <DatabaseOutlined />
                <span>集合管理</span>
              </Space>
            ),
            children: (
              <>
                {/* Stat Cards */}
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
                        valueStyle={
                          errorCount > 0
                            ? { color: '#ff4d4f' }
                            : { color: '#52c41a' }
                        }
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Action bar */}
                <Row justify="end" style={{ marginBottom: 16 }}>
                  <Space>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadCollections}
                      loading={loading}
                    >
                      刷新
                    </Button>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setModalOpen(true)}
                    >
                      新建集合
                    </Button>
                  </Space>
                </Row>

                {/* Collection Table */}
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
                    locale={{
                      emptyText: (
                        <Empty description="暂无集合，点击「新建集合」创建" />
                      ),
                    }}
                  />
                </Card>

                {/* Sync Workflows Table */}
                <Card
                  title={
                    <Space>
                      <SyncOutlined />
                      <span>同步工作流</span>
                      <Tag>{syncWorkflows.length}</Tag>
                    </Space>
                  }
                  extra={
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadSyncWorkflows}
                      loading={syncLoading}
                    >
                      刷新
                    </Button>
                  }
                  style={{ marginBottom: 24 }}
                >
                  <Table
                    columns={[
                      {
                        title: '工作流名称',
                        dataIndex: 'name',
                        key: 'name',
                      },
                      {
                        title: '节点数',
                        dataIndex: 'nodeCount',
                        key: 'nodeCount',
                        width: 80,
                      },
                      {
                        title: '最后更新',
                        dataIndex: 'updatedAt',
                        key: 'updatedAt',
                        width: 200,
                        render: (t: string) =>
                          t ? new Date(t).toLocaleString() : '-',
                      },
                      {
                        title: '操作',
                        key: 'actions',
                        width: 280,
                        render: (_: any, record: SyncWorkflowItem) => (
                          <Space>
                            <Button
                              type="primary"
                              icon={<PlayCircleOutlined />}
                              loading={runningSyncId === record.id}
                              onClick={() => handleRunSync(record.id)}
                            >
                              运行
                            </Button>
                            <Button
                              icon={<EditOutlined />}
                              onClick={() => handleEditSync(record.id)}
                            >
                              编辑
                            </Button>
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                handleDeleteSync(record.id, record.name)
                              }
                            ></Button>
                          </Space>
                        ),
                      },
                    ]}
                    dataSource={syncWorkflows}
                    rowKey="id"
                    loading={syncLoading}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty description="暂无含知识库写入节点的工作流" />
                      ),
                    }}
                  />

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
                      />
                    </Panel>
                  </Collapse>
                </Card>
              </>
            ),
          },

          // ===== Tab 2: 文档管理 =====
          {
            key: 'docs',
            label: (
              <Space>
                <FileTextOutlined />
                <span>文档管理</span>
              </Space>
            ),
            children: (
              <>
                {/* Upload Area */}
                <Card style={{ marginBottom: 24 }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Row
                      gutter={[16, 12]}
                      style={{ marginBottom: 16 }}
                      align="middle"
                    >
                      <Col>
                        <Text strong>目标集合</Text>
                      </Col>
                      <Col>
                        <Select
                          placeholder="选择目标集合"
                          style={{ width: 220 }}
                          value={uploadCollection || undefined}
                          onChange={setUploadCollection}
                          options={collections.map((c) => ({
                            value: c.name,
                            label: c.name,
                          }))}
                        />
                      </Col>
                      <Col>
                        <Text strong>Embedding 模型</Text>
                      </Col>
                      <Col>
                        <Select
                          placeholder="自动选择（推荐）"
                          style={{ width: 240 }}
                          allowClear
                          value={embedModelId || undefined}
                          onChange={setEmbedModelId}
                          options={modelList.map((m) => ({
                            value: m.id,
                            label: m.name,
                          }))}
                        />
                      </Col>
                    </Row>

                    <Upload.Dragger
                      accept=".txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.go,.rs,.css,.scss,.html,.xml,.yaml,.yml,.csv"
                      multiple
                      showUploadList={false}
                      beforeUpload={(file) => {
                        if (!uploadCollection) {
                          message.warning('请先选择目标集合')
                          return Upload.LIST_IGNORE
                        }
                        handleProcessDoc(file, uploadCollection)
                        return false // 阻止默认上传
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">
                        点击或拖拽文件到此区域上传
                      </p>
                      <p className="ant-upload-hint">
                        支持 txt / md / 代码文件（单文件 ≤
                        5MB），系统将自动分块并向量化写入 Qdrant
                      </p>
                    </Upload.Dragger>
                  </Space>
                </Card>

                {/* Document List */}
                <Card
                  title={
                    <Space>
                      <FileTextOutlined />
                      <span>处理记录</span>
                      <Tag>{docs.length}</Tag>
                    </Space>
                  }
                >
                  {docs.length === 0 ? (
                    <Empty description="暂无文档处理记录，上传文档后自动显示" />
                  ) : (
                    <List
                      dataSource={docs}
                      renderItem={(doc) => (
                        <List.Item
                          actions={
                            doc.status === 'error'
                              ? [
                                  <Tooltip title={doc.error}>
                                    <Text
                                      type="danger"
                                      style={{ fontSize: 12, maxWidth: 200 }}
                                      ellipsis
                                    >
                                      {doc.error}
                                    </Text>
                                  </Tooltip>,
                                ]
                              : undefined
                          }
                        >
                          <List.Item.Meta
                            avatar={
                              doc.status === 'processing' ? (
                                <LoadingOutlined
                                  style={{ fontSize: 24, color: '#1890ff' }}
                                />
                              ) : doc.status === 'success' ? (
                                <CheckCircleOutlined
                                  style={{ fontSize: 24, color: '#52c41a' }}
                                />
                              ) : (
                                <CloseCircleOutlined
                                  style={{ fontSize: 24, color: '#ff4d4f' }}
                                />
                              )
                            }
                            title={
                              <Space>
                                <Text strong>{doc.fileName}</Text>
                                <Tag>{doc.collectionName}</Tag>
                                {doc.status === 'processing' && (
                                  <Tag color="processing">处理中</Tag>
                                )}
                                {doc.status === 'success' && (
                                  <Tag color="success">已完成</Tag>
                                )}
                                {doc.status === 'error' && (
                                  <Tag color="error">失败</Tag>
                                )}
                              </Space>
                            }
                            description={
                              <Space>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {doc.createdAt}
                                </Text>
                                {doc.status === 'success' && (
                                  <>
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: 12 }}
                                    >
                                      | {doc.totalChunks} 个块 |{' '}
                                      {doc.totalVectors} 个向量
                                    </Text>
                                    <Progress
                                      percent={100}
                                      style={{ width: 120, margin: 0 }}
                                      showInfo={false}
                                    />
                                  </>
                                )}
                                {doc.status === 'processing' && (
                                  <Progress
                                    percent={50}
                                    style={{ width: 120, margin: 0 }}
                                    showInfo={false}
                                    status="active"
                                  />
                                )}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </Card>
              </>
            ),
          },
          // ===== Tab 2: 可视化集合 =====
          {
            key: 'visualize',
            label: (
              <Space>
                <ApartmentOutlined />
                <span>可视化集合</span>
              </Space>
            ),
            children: (
              <VectorGraph collectionName={visualizeCollection} />
            ),
          },
        ]}
      />

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
            <Input.TextArea
              rows={3}
              placeholder="集合用途说明（选填）"
              maxLength={200}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="embedModelId"
            label="Embedding 模型"
            tooltip="选择用于该集合的向量化模型，将自动匹配向量维度"
          >
            <Select
              placeholder="选择模型（自动填充维度）"
              allowClear
              options={modelList.map((m) => ({ value: m.id, label: m.name }))}
              onChange={async (val) => {
                if (!val) return
                try {
                  const res = await fetch('/api/execute/embed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: ['hello'], modelId: val }),
                  })
                  const data = await res.json()
                  if (data.status === 'success') {
                    form.setFieldsValue({ vectorSize: data.output.dimensions })
                  }
                } catch {
                  // 探测失败，保持用户手动输入
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="vectorSize"
            label="向量维度"
            tooltip="根据使用的 Embedding 模型设置"
          >
            <Input type="number" min={64} max={8192} />
          </Form.Item>
          <Form.Item name="distance" label="距离算法" tooltip="影响检索相关性">
            <Input placeholder="Cosine / Euclidean / Dot" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
