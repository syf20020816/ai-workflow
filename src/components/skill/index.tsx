import { useBmadAgentStore } from '#/store/bmad'
import { useSkillStore } from '#/store/skill'
import { Table, Tag, Space, Typography, Button, Tabs, Modal, Input, message } from 'antd'
import { useEffect, useState } from 'react'
import { ReloadIcon, PlusIcon, FileIcon, UploadIcon } from '@radix-ui/react-icons'

const { Text } = Typography

const moduleColorMap: Record<string, string> = {
  bmm: 'blue',
  bmb: 'green',
  tea: 'orange',
}

const sourceColorMap: Record<string, string> = {
  bmad: 'pink',
  custom: 'cyan',
  markdown: 'purple',
}

export const SkillManager = () => {
  const agents = useBmadAgentStore((state) => state.agents)
  const loading = useBmadAgentStore((state) => state.loading)
  const fetchAgents = useBmadAgentStore((state) => state.fetchAgents)

  const customSkills = useSkillStore((state) => state.skills)
  const skillLoading = useSkillStore((state) => state.loading)
  const fetchSkills = useSkillStore((state) => state.fetchSkills)
  const createSkill = useSkillStore((state) => state.createSkill)
  const deleteSkill = useSkillStore((state) => state.deleteSkill)

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
        body: JSON.stringify(importDir ? { dirPath: importPath.trim() } : { filePath: importPath.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        message.success(`导入成功: ${data.logs?.join('; ')}`)
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

  const bmadColumns = [
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
          <Tag color={moduleColorMap[record.module]}>{record.module?.toUpperCase()}</Tag>
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
      render: (team: string) => team?.replace('-', ' '),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ]

  const customColumns = [
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 90,
      render: (source: string) => (
        <Tag color={sourceColorMap[source] || 'default'}>{source || 'custom'}</Tag>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, record: any) => (
        <Button
          type="text"
          size="small"
          danger
          onClick={() => deleteSkill(record.id)}
        >
          删除
        </Button>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'bmad',
      label: `BMad 角色 (${agents.length})`,
      children: (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              角色数据来源于 BMad 配置文件 (<code>bmad/_bmad/config.toml</code>)
            </Text>
            <Button size="small" icon={<ReloadIcon />} onClick={fetchAgents} loading={loading}>
              刷新
            </Button>
          </div>
          <Table
            dataSource={agents}
            columns={bmadColumns}
            rowKey="id"
            loading={loading}
            pagination={false}
            size="small"
          />
        </>
      ),
    },
    {
      key: 'custom',
      label: `自定义技能 (${customSkills.length})`,
      children: (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              自定义技能可通过导入 Markdown 文件创建，用于 Skill 节点
            </Text>
            <Space>
              <Button
                size="small"
                icon={<UploadIcon />}
                onClick={() => { setImportDir(false); setImportPath(''); setImportModalOpen(true) }}
              >
                导入文件
              </Button>
              <Button
                size="small"
                icon={<FileIcon />}
                onClick={() => { setImportDir(true); setImportPath(''); setImportModalOpen(true) }}
              >
                扫描目录
              </Button>
              <Button size="small" icon={<ReloadIcon />} onClick={fetchSkills} loading={skillLoading}>
                刷新
              </Button>
            </Space>
          </div>
          <Table
            dataSource={customSkills}
            columns={customColumns}
            rowKey="id"
            loading={skillLoading}
            pagination={false}
            size="small"
          />
        </>
      ),
    },
  ]

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>技能管理</h2>
      <Tabs items={tabItems} />

      <Modal
        title={importDir ? '扫描目录导入技能' : '导入 Markdown 技能文件'}
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onOk={handleImport}
        confirmLoading={importing}
        okText="导入"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            {importDir
              ? '输入相对于项目根目录的文件夹路径，扫描所有 .md 文件导入为技能'
              : '输入相对于项目根目录的 .md 文件路径，导入为技能'}
          </Text>
        </div>
        <Input
          placeholder={importDir ? '例如: skills/' : '例如: skills/architect.md'}
          value={importPath}
          onChange={(e) => setImportPath(e.target.value)}
        />
      </Modal>
    </div>
  )
}
