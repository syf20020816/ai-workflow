/**
 * 执行结果页
 *
 * 左侧：执行历史列表（可按 Spec / 常规 筛选）
 * 右侧：选中记录的「执行日志」「节点输出」
 *   - 节点输出：优先展示 output.response 文本，其余元数据字段折叠查看
 */

import { useEffect, useState } from 'react'
import {
  Button,
  Collapse,
  Empty,
  Modal,
  Segmented,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  DeleteOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { CodeEditor } from '#/components/file-editor/editor'
import type { LogEntry } from '#/types/engine'
import styles from './index.module.scss'

const { Text } = Typography

interface ExecNodeResult {
  nodeId: string
  nodeTitle: string
  status: 'success' | 'error' | 'waiting'
  output: Record<string, any>
  error?: string
}

interface ExecRecord {
  filename: string
  workflowId: string
  workflowName: string
  timestamp: string
  status: 'completed' | 'error' | 'paused'
  globalMode?: 'normal' | 'spec'
  nodeCount: number
  nodeResults: ExecNodeResult[]
  logs: LogEntry[]
}

const statusMeta: Record<string, { color: string; label: string }> = {
  completed: { color: 'success', label: '成功' },
  error: { color: 'error', label: '失败' },
  paused: { color: 'warning', label: '中断' },
}

const levelColorMap: Record<string, string> = {
  info: 'green',
  warn: 'orange',
  error: 'red',
  debug: 'default',
}

/** 提取用户关心的文本：优先 response 字段，其余元数据作为 extra 单独折叠 */
function extractText(output: Record<string, any>): {
  text: string
  extra: Record<string, any> | null
} {
  if (!output) return { text: '', extra: null }
  if (typeof output.response === 'string' && output.response) {
    const extra = { ...output }
    delete extra.response
    return {
      text: output.response,
      extra: Object.keys(extra).length ? extra : null,
    }
  }
  return { text: JSON.stringify(output, null, 2), extra: null }
}

export const Execution = () => {
  const [records, setRecords] = useState<ExecRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'spec' | 'normal'>('all')
  const [selected, setSelected] = useState<ExecRecord | null>(null)
  const [rawNodeIds, setRawNodeIds] = useState<Set<string>>(new Set())

  const loadRecords = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workflow/exec-history')
      const data = await res.json()
      if (Array.isArray(data)) setRecords(data)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [])

  // 默认选中最新一条执行记录
  useEffect(() => {
    if (!selected && records.length > 0) setSelected(records[0])
  }, [records])

  /** 选中记录：加载完整内容（含 logs） */
  const handleSelect = async (record: ExecRecord) => {
    setSelected(record)
    setRawNodeIds(new Set())
    try {
      const res = await fetch(
        `/api/workflow/exec-history?filename=${encodeURIComponent(record.filename)}`,
      )
      const full = await res.json()
      if (full && Array.isArray(full.nodeResults)) {
        setSelected({
          ...full,
          filename: record.filename,
          globalMode: full.globalMode ?? record.globalMode,
        })
      }
    } catch {
      // 列表数据已够用
    }
  }

  const toggleRaw = (nodeId: string) => {
    setRawNodeIds((prev) => {
      const s = new Set(prev)
      if (s.has(nodeId)) s.delete(nodeId)
      else s.add(nodeId)
      return s
    })
  }

  const handleDelete = (filename: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该执行结果记录吗？',
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
            if (selected?.filename === filename) setSelected(null)
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

  const handleReExecute = async (record: ExecRecord) => {
    try {
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

  const filtered = records.filter((r) => {
    if (filter === 'all') return true
    return (r.globalMode || 'normal') === filter
  })

  // ---- 右侧 Tabs ----
  const logTab = selected?.logs?.length ? (
    <Timeline
      className={styles.log_timeline}
      items={selected.logs.map((l) => ({
        color: levelColorMap[l.level] || 'blue',
        children: (
          <div className={styles.log_item}>
            <Text className={styles.log_node}>{l.nodeTitle}</Text>
            <Text>{l.message}</Text>
          </div>
        ),
      }))}
    />
  ) : (
    <Empty description="无执行日志" />
  )

  const nodesTab = selected?.nodeResults?.length ? (
    <Collapse
      ghost
      size="small"
      defaultActiveKey={selected.nodeResults.map((r) => r.nodeId)}
      items={selected.nodeResults.map((r) => {
        const { text, extra } = extractText(r.output)
        const isRaw = rawNodeIds.has(r.nodeId)
        return {
          key: r.nodeId,
          label: (
            <div className={styles.node_label}>
              <Text strong className={styles.node_title}>
                {r.nodeTitle || '未命名节点'}
              </Text>
              <Tag
                color={
                  r.status === 'success'
                    ? 'success'
                    : r.status === 'error'
                      ? 'error'
                      : 'default'
                }
                className={styles.tag_nomargin}
              >
                {r.status === 'success'
                  ? '成功'
                  : r.status === 'error'
                    ? '失败'
                    : '等待'}
              </Tag>
            </div>
          ),
          children:
            r.status === 'error' && r.error ? (
              <Text type="danger">{r.error}</Text>
            ) : (
              <div>
                <div className={styles.output_box}>
                  <CodeEditor
                    value={isRaw ? JSON.stringify(r.output, null, 2) : text}
                    readOnly
                    language={isRaw ? 'json' : undefined}
                  />
                </div>
                {(extra || !text) && (
                  <Button
                    size="small"
                    type="link"
                    className={styles.raw_btn}
                    onClick={() => toggleRaw(r.nodeId)}
                  >
                    {isRaw ? '收起完整字段' : '查看完整字段'}
                  </Button>
                )}
              </div>
            ),
        }
      })}
    />
  ) : (
    <Empty description="无节点输出" />
  )

  const filesTab = (
    <Empty description="编排阶段不产出文件（最终工作流导出为 workflow.yml 交给 Codex/Trae 等工具执行）" />
  )

  const tabItems = [
    { key: 'logs', label: '执行日志', children: logTab },
    { key: 'nodes', label: '节点输出', children: nodesTab },
    { key: 'files', label: '文件结果', children: filesTab },
  ]

  return (
    <div className={styles.container}>
      {/* 左侧：执行历史列表 */}
      <div className={styles.sidebar}>
        <div className={styles.sidebar_header}>
          <div className={styles.sidebar_title_row}>
            <Text strong className={styles.sidebar_title}>
              执行结果
            </Text>
            <Tooltip title="刷新">
              <Button
                icon={<ReloadOutlined />}
                onClick={loadRecords}
                loading={loading}
              />
            </Tooltip>
          </div>
          <Segmented
            block
            value={filter}
            onChange={(v) => setFilter(v as any)}
            options={[
              { label: '全部', value: 'all' },
              { label: 'Spec', value: 'spec' },
              { label: '常规', value: 'normal' },
            ]}
          />
        </div>
        <div className={styles.sidebar_list}>
          {filtered.map((r) => {
            const isSel = selected?.filename === r.filename
            return (
              <div
                key={r.filename}
                onClick={() => handleSelect(r)}
                className={`${styles.item} ${isSel ? styles.item_selected : ''}`}
              >
                <div className={styles.item_title_row}>
                  <Text strong className={styles.item_name}>
                    {r.workflowName || r.workflowId}
                  </Text>
                  <Tag
                    color={statusMeta[r.status]?.color || 'default'}
                    className={styles.tag_nomargin}
                  >
                    {statusMeta[r.status]?.label || r.status}
                  </Tag>
                </div>
                <div className={styles.item_meta_row}>
                  <Tag
                    className={styles.tag_nomargin}
                    color={r.globalMode === 'spec' ? 'blue' : 'default'}
                  >
                    {r.globalMode === 'spec' ? 'Spec' : '常规'}
                  </Tag>
                  <Text type="secondary" className={styles.item_time}>
                    {r.timestamp
                      ? new Date(Number(r.timestamp)).toLocaleString()
                      : ''}
                  </Text>
                </div>
              </div>
            )
          })}
          {!filtered.length && (
            <div className={styles.empty_pad}>
              <Empty description="暂无执行结果" />
            </div>
          )}
        </div>
      </div>

      {/* 右侧：执行详情 */}
      <div className={styles.detail}>
        {!selected ? (
          <Empty className={styles.detail_empty} description="请选择一次执行" />
        ) : (
          <>
            <div className={styles.detail_header}>
              <Text strong className={styles.detail_title}>
                {selected.workflowName || selected.workflowId}
              </Text>
              <Tag color={statusMeta[selected.status]?.color}>
                {statusMeta[selected.status]?.label || selected.status}
              </Tag>
              <Tag color={selected.globalMode === 'spec' ? 'blue' : 'default'}>
                {selected.globalMode === 'spec' ? 'Spec' : '常规'}
              </Tag>
              <Text type="secondary" className={styles.detail_time}>
                {selected.timestamp
                  ? new Date(Number(selected.timestamp)).toLocaleString()
                  : ''}
              </Text>
              <div className={styles.detail_spacer} />
              <Tooltip title="重新执行">
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleReExecute(selected)}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(selected.filename)}
                />
              </Tooltip>
            </div>
            <Tabs items={tabItems} />
          </>
        )}
      </div>
    </div>
  )
}
