import {
  Button,
  Table,
  Typography,
  Tag,
  Space,
  message,
  Modal,
  Tooltip,
  Select,
} from 'antd'
import {
  DeleteOutlined,
  PlayCircleOutlined,
  UndoOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { useEffect, useState, useCallback } from 'react'
import type { TableProps } from 'antd'

const { Text } = Typography

interface ExecHistoryRecord {
  filename: string
  workflowId: string
  workflowName: string
  timestamp: string
  status: 'completed' | 'error' | 'paused'
  nodeCount: number
  nodeResults: Array<{
    nodeId: string
    nodeTitle: string
    status: 'success' | 'error' | 'waiting'
    output: Record<string, any>
    error?: string
  }>
  logs: Array<{
    timestamp: number
    nodeId: string
    nodeTitle: string
    level: string
    message: string
  }>
}
export interface ExecHistoryProps {
  size?: 'small' | 'medium'
  /** 指定工作流 ID，用于编辑器 Tab 内自动过滤，此时不显示工作流选择框 */
  workflowId?: string
}

export const ExecutionHistory = ({
  size = 'medium',
  workflowId,
}: ExecHistoryProps) => {
  const [records, setRecords] = useState<ExecHistoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [workflowList, setWorkflowList] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [filterWorkflow, setFilterWorkflow] = useState<string | undefined>(
    workflowId,
  )

  // 页面级别：加载工作流列表供选择
  useEffect(() => {
    if (workflowId) {
      setFilterWorkflow(workflowId)
      return
    }
    const loadWorkflows = async () => {
      try {
        const res = await fetch('/api/workflows')
        const data = await res.json()
        if (Array.isArray(data)) {
          setWorkflowList(data.map((w: any) => ({ id: w.id, name: w.name })))
        }
      } catch {
        // 静默
      }
    }
    loadWorkflows()
  }, [workflowId])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterWorkflow) params.set('workflowId', filterWorkflow)
      const res = await fetch(`/api/workflow/exec-history?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setRecords(data)
      }
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [filterWorkflow])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const handleDelete = (filename: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该执行历史记录吗？',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await fetch(
            `/api/workflow/exec-history?filename=${encodeURIComponent(filename)}`,
            { method: 'DELETE' },
          )
          const data = await res.json()
          if (data.success) {
            message.success('已删除')
            loadRecords()
          } else {
            message.error(data.error || '删除失败')
          }
        } catch (err: any) {
          message.error(`删除失败: ${err.message}`)
        }
      },
    })
  }

  const handleRestore = async (record: ExecHistoryRecord) => {
    try {
      // 加载完整记录（含 logs、nodeResults 详情）
      const res = await fetch(
        `/api/workflow/exec-history?filename=${encodeURIComponent(record.filename)}`,
      )
      const full = await res.json()
      if (!full.nodeResults) {
        message.error('记录数据不完整')
        return
      }
      // 恢复到编辑器：将节点执行结果注入 PipelineContext
      const { useNodeStore } = await import('#/store/node')
      const store = useNodeStore.getState()
      const { createPipelineContext } = await import('#/engine/workflow')
      const ctx = createPipelineContext()
      ctx.globalStatus = 'completed'
      for (const nr of full.nodeResults) {
        ctx.nodeOutputs[nr.nodeId] = nr.output
        ctx.nodeStatuses[nr.nodeId] =
          nr.status === 'success' ? 'success' : 'error'
      }
      ctx.logs = full.logs || []
      store.resetExecution()
      // 直接设置 pipelineContext 来恢复结果
      ;(store as any).pipelineContext = ctx
      // 通过 set 更新
      const { useNodeStore: useNS } = await import('#/store/node')
      useNS.setState({ pipelineContext: ctx })
      message.success('执行结果已恢复，可在「输出」和「执行结果」Tab 中查看')
    } catch (err: any) {
      message.error(`恢复失败: ${err.message}`)
    }
  }

  const handleReExecute = async (record: ExecHistoryRecord) => {
    try {
      // 加载对应的工作流
      const res = await fetch(
        `/api/workflows?id=${encodeURIComponent(record.workflowId)}`,
      )
      if (!res.ok) {
        message.error('找不到对应的工作流文件')
        return
      }
      const data = await res.json()
      if (!data.nodes || !data.edges) {
        message.error('工作流数据不完整')
        return
      }
      const { useNodeStore } = await import('#/store/node')
      const { useRouteStore } = await import('#/store/route')
      const store = useNodeStore.getState()
      store.setWorkflowId(data.id || record.workflowId)
      store.setNodes(data.nodes)
      store.setEdges(data.edges)
      useRouteStore.getState().switchTo('workflow')
      message.success(
        `已加载「${data.name || record.workflowId}」到编辑器，点击运行即可重新执行`,
      )
    } catch (err: any) {
      message.error(`加载失败: ${err.message}`)
    }
  }

  const columns: TableProps<ExecHistoryRecord>['columns'] = [
    {
      title: '工作流',
      width: 200,
      dataIndex: 'workflowName',
      key: 'workflowName',
      render: (name: string, record: ExecHistoryRecord) => (
        <Text strong>{name || record.workflowId}</Text>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 200,
      render: (t: string) => (t ? new Date(Number(t)).toLocaleString() : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const map: Record<string, { color: string; label: string }> = {
          completed: { color: 'success', label: '成功' },
          error: { color: 'error', label: '失败' },
          paused: { color: 'warning', label: '中断' },
        }
        const s = map[status] ?? { color: 'default', label: status }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '执行节点',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
      width: 100,
      render: (_: number, record: ExecHistoryRecord) => {
        const successCount = record.nodeResults.filter(
          (r) => r.status === 'success',
        ).length
        return (
          <Tooltip
            title={`${successCount} 成功 / ${record.nodeResults.length - successCount} 失败`}
          >
            <Text>
              {successCount}/{record.nodeResults.length}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: ExecHistoryRecord) => (
        <Space>
          <Tooltip title="恢复">
            <Button
              size={size}
              icon={<UndoOutlined />}
              onClick={() => handleRestore(record)}
            ></Button>
          </Tooltip>
          <Tooltip title="重新执行">
            <Button
              size={size}
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleReExecute(record)}
            ></Button>
          </Tooltip>
          <Tooltip title="删除">
            <Button
              size={size}
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.filename)}
            ></Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <span
            style={{ fontSize: size === 'small' ? 14 : 18, fontWeight: 700 }}
          >
            执行历史
          </span>
          <Tag>{records.length}</Tag>
          {!workflowId && (
            <Select
              placeholder="按工作流筛选"
              allowClear
              style={{ width: 220 }}
              value={filterWorkflow}
              onChange={(val) => {
                setFilterWorkflow(val)
              }}
              options={workflowList.map((w) => ({
                value: w.id,
                label: w.name,
              }))}
            />
          )}
        </Space>
        <Button
          icon={<HistoryOutlined />}
          onClick={loadRecords}
          loading={loading}
        >
          刷新
        </Button>
      </div>
      <Table<ExecHistoryRecord>
        columns={columns}
        dataSource={records}
        rowKey="filename"
        loading={loading}
        pagination={{ pageSize: 10, size: 'small' }}
        size="small"
        locale={{ emptyText: '暂无执行历史' }}
      />
    </div>
  )
}
