import {
  Button,
  message,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
} from 'antd'

import { useEffect, useState } from 'react'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useRouteStore } from '#/store/route'
import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
import { useBmadAgentStore } from '#/store/bmad'
import { useSkillStore } from '#/store/skill'
import type { Model } from '#/types/model'
import { ModalKinds } from '#/types/model'
import { FileScan, RefreshCw, Upload } from 'lucide-react'
import { EditButton } from '../button'

const { Text } = Typography

/** 版本选择框的默认项：表示加载主文件（工作流当前状态），而非某个历史版本快照 */
const LATEST_VERSION_KEY = '__latest__'

/** 工作流表格 */
const WorkflowTab = ({ loading }: { loading: boolean }) => {
  const openInEditor = useRouteStore((s) => s.openInEditor)
  const switchTo = useRouteStore((s) => s.switchTo)
  const setNodes = useNodeStore((s) => s.setNodes)
  const setEdges = useNodeStore((s) => s.setEdges)
  const setWorkflowId = useNodeStore((s) => s.setWorkflowId)
  const [list, setList] = useState<any[]>([])
  const [l, setL] = useState(false)
  const [versionMap, setVersionMap] = useState<Record<string, any[]>>({})
  const [selectedVersion, setSelectedVersion] = useState<
    Record<string, string>
  >({})
  const [loadingVersions, setLoadingVersions] = useState<
    Record<string, boolean>
  >({})

  const loadList = async () => {
    setL(true)
    try {
      const res = await window.fetch('/api/workflows')
      if (res.ok) {
        const data = await res.json()
        setList(data)
        // 预加载有版本记录的行的版本列表，使最新版本默认可选
        ;(data || []).forEach((row: any) => {
          if (row.versionCount > 0) loadVersions(row.id)
        })
      } else console.error('load workflow list failed:', res.status)
    } catch (err) {
      console.error('load workflow list error:', err)
    } finally {
      setL(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [])

  const handleLoad = async (id: string, name: string, versionId?: string) => {
    try {
      const params = new URLSearchParams({ id })
      if (versionId) params.set('versionId', versionId)
      const res = await fetch(`/api/workflows?${params}`)
      if (!res.ok) {
        message.error('加载工作流文件失败')
        return
      }
      const data = await res.json()
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
      setWorkflowId(data.id || id)
      switchTo('workflow')
      message.success(
        `已加载工作流: ${name}${versionId ? ` (版本: ${versionId})` : ''}`,
      )
    } catch (err: any) {
      message.error('加载失败: ' + err.message)
    }
  }

  // 加载某工作流的版本列表（force=true 时强制重新拉取）
  const loadVersions = async (workflowId: string, force = false) => {
    if (!force && versionMap[workflowId]) return // 已加载
    setLoadingVersions((prev) => ({ ...prev, [workflowId]: true }))
    try {
      const res = await fetch(`/api/workflow/versions?id=${workflowId}`)
      if (res.ok) {
        const data = await res.json()
        setVersionMap((prev) => ({
          ...prev,
          [workflowId]: data.versions || [],
        }))
      }
    } catch {
      /* 静默 */
    }
    setLoadingVersions((prev) => ({ ...prev, [workflowId]: false }))
  }

  // 删除某个历史版本
  const handleDeleteVersion = async (workflowId: string, versionId: string) => {
    Modal.confirm({
      title: `确认删除版本 "${versionId}"？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        const res = await fetch(
          `/api/workflow/versions?id=${encodeURIComponent(workflowId)}&versionId=${encodeURIComponent(versionId)}`,
          { method: 'DELETE' },
        )
        if (res.ok) {
          message.success('版本已删除')
          // 若删除的是当前选中的版本，清空选中
          setSelectedVersion((prev) => {
            if (prev[workflowId] !== versionId) return prev
            const next = { ...prev }
            delete next[workflowId]
            return next
          })
          await loadVersions(workflowId, true)
          loadList()
        } else {
          message.error('删除版本失败')
        }
      },
    })
  }

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: `确认删除工作流 "${name}"？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        const res = await fetch(`/api/workflows?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          message.success('已删除')
          loadList()
        }
      },
    })
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <Text strong>{n}</Text>,
    },
    {
      title: '节点',
      dataIndex: 'nodeCount',
      key: 'nodeCount',
      width: 60,
      align: 'center' as const,
      render: (c: number) => <Tag>{c}</Tag>,
    },
    {
      title: '连线',
      dataIndex: 'edgeCount',
      key: 'edgeCount',
      width: 60,
      align: 'center' as const,
      render: (c: number) => <Tag>{c}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'versionCount',
      key: 'versionCount',
      width: 260,
      render: (vc: number, r: any) => {
        const versions = versionMap[r.id] || []
        const sel = selectedVersion[r.id]
        if (vc === 0)
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              latest
            </Text>
          )
        // 按 versionId 内嵌的创建时间戳倒序（比 createdAt 字符串排序更可靠），最新版本排首位
        const sortedVersions = [...versions].sort(
          (a: any, b: any) =>
            Number(String(b.versionId).replace('v-', '')) -
            Number(String(a.versionId).replace('v-', '')),
        )
        // 未显式选择版本时默认选中 latest（对应加载主文件 = 工作流当前状态）
        const effectiveValue = sel || LATEST_VERSION_KEY
        return (
          <Select
            style={{ width: '100%' }}
            placeholder={vc > 0 ? '选择历史版本' : 'latest'}
            loading={loadingVersions[r.id]}
            value={effectiveValue}
            onDropdownVisibleChange={(open) => {
              if (open) loadVersions(r.id, true)
            }}
            onChange={(v) => {
              setSelectedVersion((prev) => ({
                ...prev,
                [r.id]: v as string,
              }))
            }}
            options={[
              {
                value: LATEST_VERSION_KEY,
                label: `latest · ${r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ''}`,
              },
              ...sortedVersions.map((v: any) => ({
                value: v.versionId,
                label: `${v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}`,
              })),
            ]}
            optionRender={(option) => (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{option.data.label}</span>
                {option.data.value !== LATEST_VERSION_KEY && (
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    title="删除该历史版本"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteVersion(r.id, String(option.data.value))
                    }}
                  />
                )}
              </div>
            )}
          />
        )
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (d: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {d ? new Date(d).toLocaleString() : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, r: any) => (
        <Space>
          <EditButton
            title="加载"
            kind="exec"
            onClick={() => {
              // latest（或未选择）加载主文件 = 工作流当前状态；显式选择的历史版本才加载快照
              const selV = selectedVersion[r.id]
              handleLoad(
                r.id,
                r.name,
                !selV || selV === LATEST_VERSION_KEY ? undefined : selV,
              )
            }}
          ></EditButton>
          <EditButton
            title="编辑"
            kind="edit"
            onClick={() => openInEditor(`workflows/${r.id}.json`)}
          ></EditButton>
          <EditButton
            title="删除"
            kind="delete"
            onClick={() => handleDelete(r.id, r.name)}
          ></EditButton>
        </Space>
      ),
    },
  ]

  return (
    <Table
      dataSource={list}
      columns={columns}
      rowKey="id"
      loading={l || loading}
      size="small"
      pagination={false}
    />
  )
}

/** 模型表格 */
const ModelTab = ({ loading }: { loading: boolean }) => {
  const models = useModelStore((s) => s.models)
  const modelLoading = useModelStore((s) => s.loading)
  const fetchModels = useModelStore((s) => s.fetchModels)
  const createModel = useModelStore((s) => s.createModel)
  const updateModel = useModelStore((s) => s.updateModel)
  const deleteModel = useModelStore((s) => s.deleteModel)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchModels()
  }, [])

  const handleEdit = (r: Model) => {
    setEditingModel(r)
    form.setFieldsValue(r)
    setModalOpen(true)
  }
  const handleCreate = () => {
    setEditingModel(null)
    form.resetFields()
    form.setFieldsValue({
      kind: ModalKinds.Cloud,
      token: { min: 100, max: 4096 },
    })
    setModalOpen(true)
  }
  const handleSave = async () => {
    try {
      const v = await form.validateFields()
      if (editingModel) {
        await updateModel({ ...editingModel, ...v })
        message.success('已更新')
      } else {
        await createModel(v)
        message.success('已创建')
      }
      setModalOpen(false)
    } catch {
      /* validation */
    }
  }
  const handleDelete = (r: Model) => {
    Modal.confirm({
      title: `确认删除模型 "${r.name}"？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        await deleteModel(r.id)
        message.success('已删除')
      },
    })
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (n: string, r: Model) => (
        <Space>
          <Tag color={r.kind === ModalKinds.Local ? 'green' : 'blue'}>
            {r.kind === ModalKinds.Local ? '本地' : '云端'}
          </Tag>
          <Text strong>{n}</Text>
        </Space>
      ),
    },
    { title: '模型', dataIndex: 'modelName', key: 'modelName' },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, r: Model) => (
        <Space>
          <EditButton
            title="编辑"
            kind="edit"
            onClick={() => handleEdit(r)}
          ></EditButton>
          <EditButton
            title="删除"
            kind="delete"
            onClick={() => handleDelete(r)}
          ></EditButton>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleCreate}
        style={{ marginBottom: 12 }}
      >
        新增模型
      </Button>
      <Table
        dataSource={models}
        columns={columns}
        rowKey="id"
        loading={modelLoading || loading}
        size="small"
        pagination={false}
      />
      <Modal
        title={editingModel ? '编辑模型' : '新增模型'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editingModel ? '保存' : '创建'}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '云端模型', value: ModalKinds.Cloud },
                { label: '本地模型', value: ModalKinds.Local },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="自定义名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="例如: GPT-4o" />
          </Form.Item>
          <Form.Item
            name="modelName"
            label="模型名"
            rules={[{ required: true, message: '请输入模型名' }]}
          >
            <Input placeholder="例如: gpt-4o" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
          <Form.Item name="url" label="API URL">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder="留空或输入密钥" />
          </Form.Item>
          <Space>
            <Form.Item name={['token', 'min']} label="最小 Token">
              <InputNumber min={0} max={128000} style={{ width: 120 }} />
            </Form.Item>
            <span>~</span>
            <Form.Item name={['token', 'max']} label="最大 Token">
              <InputNumber min={0} max={307200} style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}

/** 技能表格 */
const SkillTab = ({ loading }: { loading: boolean }) => {
  const bmadAgents = useBmadAgentStore((s) => s.agents)
  const bmadLoading = useBmadAgentStore((s) => s.loading)
  const fetchAgents = useBmadAgentStore((s) => s.fetchAgents)
  const customSkills = useSkillStore((s) => s.skills)
  const skillLoading = useSkillStore((s) => s.loading)
  const fetchSkills = useSkillStore((s) => s.fetchSkills)
  const deleteSkill = useSkillStore((s) => s.deleteSkill)

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importPath, setImportPath] = useState('')
  const [importDir, setImportDir] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    fetchAgents()
    fetchSkills()
  }, [])

  const handleImport = async () => {
    if (!importPath.trim()) return
    setImporting(true)
    try {
      const res = await fetch('/api/skill/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          importDir
            ? { dirPath: importPath.trim() }
            : { filePath: importPath.trim() },
        ),
      })
      const data = await res.json()
      if (data.success) {
        message.success('导入成功')
        fetchSkills()
        setImportModalOpen(false)
        setImportPath('')
      } else {
        message.error(data.error || '导入失败')
      }
    } catch (err: any) {
      message.error(`导入失败: ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = (r: any) => {
    Modal.confirm({
      title: `确认删除技能 "${r.name}"？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        await deleteSkill(r.id)
        message.success('已删除')
      },
    })
  }

  const moduleColorMap: Record<string, string> = {
    bmm: 'blue',
    bmb: 'green',
    tea: 'orange',
  }

  const bmadColumns = [
    {
      title: '角色',
      dataIndex: 'title',
      key: 'title',
      render: (_: string, r: any) => (
        <Space>
          <Tag color={moduleColorMap[r.module]}>{r.module?.toUpperCase()}</Tag>
          <span>{r.title}</span>
        </Space>
      ),
    },
    { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
    {
      title: '团队',
      dataIndex: 'team',
      key: 'team',
      render: (t: string) => t.replace('-', ' ') || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '来源',
      key: 'action',
      width: 120,
      render: () => <Tag style={{ fontSize: 9 }}>BMad</Tag>,
    },
  ]

  const customColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, r: any) => (
        <EditButton
          title="删除"
          kind="delete"
          onClick={() => handleDelete(r)}
        ></EditButton>
      ),
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Button
          icon={<Upload height={16} />}
          onClick={() => {
            setImportDir(false)
            setImportPath('')
            setImportModalOpen(true)
          }}
        >
          导入文件
        </Button>
        <Button
          icon={<FileScan height={16} />}
          onClick={() => {
            setImportDir(true)
            setImportPath('')
            setImportModalOpen(true)
          }}
        >
          扫描目录
        </Button>
        <Button
          icon={<RefreshCw height={16} />}
          onClick={async () => {
            // 先触发 rescan 同步 index.json，再重新加载
            await fetch('/api/skill?rescan=true')
            fetchSkills()
          }}
          loading={skillLoading}
        >
          刷新
        </Button>
      </div>
      <Tabs
        items={[
          {
            key: 'bmad',
            label: `BMad 角色 (${bmadAgents.length})`,
            children: (
              <Table
                dataSource={bmadAgents}
                columns={bmadColumns}
                rowKey="id"
                loading={bmadLoading || loading}
                size="small"
                pagination={false}
              />
            ),
          },
          {
            key: 'custom',
            label: `自定义技能 (${customSkills.length})`,
            children: (
              <Table
                dataSource={customSkills}
                columns={customColumns}
                rowKey="id"
                loading={skillLoading || loading}
                size="small"
                pagination={false}
              />
            ),
          },
        ]}
      />
      <Modal
        title={importDir ? '扫描目录导入技能' : '导入 Markdown 技能文件'}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onOk={handleImport}
        confirmLoading={importing}
        okText="导入"
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            {importDir
              ? '输入相对于项目根目录的文件夹路径，扫描所有 .md 文件导入为技能'
              : '输入相对于项目根目录的 .md 文件路径，导入为技能'}
          </Text>
        </div>
        <Input
          placeholder={
            importDir ? '例如: skills/' : '例如: skills/architect.md'
          }
          value={importPath}
          onChange={(e) => setImportPath(e.target.value)}
        />
      </Modal>
    </>
  )
}

/** 提示词表格 */
const PromptTab = ({ loading }: { loading: boolean }) => {
  const openInEditor = useRouteStore((s) => s.openInEditor)
  const [list, setList] = useState<any[]>([])
  const [l, setL] = useState(false)

  const loadList = async () => {
    setL(true)
    try {
      const res = await window.fetch('/api/editor/list')
      const data = await res.json()
      if (data.status === 'success') {
        for (const g of data.data) {
          if (g.title.startsWith('提示词')) {
            setList(g.files || [])
            return
          }
        }
      }
      setList([])
    } catch {
      /* ignore */
    } finally {
      setL(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [])

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <Text strong>{n}</Text>,
    },
    {
      title: '路径',
      dataIndex: 'relativePath',
      key: 'relativePath',
      render: (p: string) => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {p}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, r: any) => (
        <EditButton
          title="编辑"
          kind="edit"
          onClick={() => openInEditor(r.relativePath)}
        ></EditButton>
      ),
    },
  ]

  return (
    <Table
      dataSource={list}
      columns={columns}
      rowKey="relativePath"
      loading={l || loading}
      size="small"
      pagination={false}
    />
  )
}

/** 记忆表格 */
const MemoryTab = ({ loading }: { loading: boolean }) => {
  const openInEditor = useRouteStore((s) => s.openInEditor)
  const [list, setList] = useState<any[]>([])
  const [l, setL] = useState(false)

  const loadList = async () => {
    setL(true)
    try {
      const res = await window.fetch('/api/editor/list')
      const data = await res.json()
      if (data.status === 'success') {
        for (const g of data.data) {
          if (g.title.startsWith('记忆')) {
            setList(g.files || [])
            return
          }
        }
      }
      setList([])
    } catch {
      /* ignore */
    } finally {
      setL(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [])

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <Text strong>{n}</Text>,
    },
    {
      title: '路径',
      dataIndex: 'relativePath',
      key: 'relativePath',
      render: (p: string) => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {p}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, r: any) => (
        <EditButton
          title="编辑"
          kind="edit"
          onClick={() => openInEditor(r.relativePath)}
        ></EditButton>
      ),
    },
  ]

  return (
    <Table
      dataSource={list}
      columns={columns}
      rowKey="relativePath"
      loading={l || loading}
      size="small"
      pagination={false}
    />
  )
}

// ── 主面板：Tabs 分组 ──
export const PromptManager = () => {
  return (
    <div
      style={{
        padding: 16,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Tabs
        tabBarStyle={{ marginBottom: 16 }}
        items={[
          {
            key: 'workflows',
            label: '工作流',
            children: <WorkflowTab loading={false} />,
          },
          {
            key: 'models',
            label: '模型',
            children: <ModelTab loading={false} />,
          },
          {
            key: 'skills',
            label: '技能',
            children: <SkillTab loading={false} />,
          },
          {
            key: 'prompts',
            label: '提示词',
            children: <PromptTab loading={false} />,
          },
          {
            key: 'memory',
            label: '记忆',
            children: <MemoryTab loading={false} />,
          },
        ]}
      />
    </div>
  )
}
