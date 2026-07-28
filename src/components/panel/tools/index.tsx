import { useState, useEffect } from 'react'
import { useNodeStore } from '#/store/node'
import { Panel } from '@xyflow/react'
import type { PanelProps, Node, Edge } from '@xyflow/react'
import {
  Button,
  Tooltip,
  Modal,
  Input,
  AutoComplete,
  Upload,
  message,
  Typography,
} from 'antd'
import {
  UploadOutlined,
  DownloadOutlined,
  CopyOutlined,
} from '@ant-design/icons'
import { BrushCleaning,  Download, Save, Upload as UploadIcon } from 'lucide-react'
import type { RcFile } from 'antd/es/upload'
import styles from '../index.module.scss'



const { TextArea } = Input
const { Text } = Typography

const iconStyle = {
  height: 16,
  width: 16,
}

interface WorkflowData {
  nodes: Node[]
  edges: Edge[]
}

export interface ToolsPanelProps extends PanelProps {}

export const ToolsPanel = (props: ToolsPanelProps) => {
  const setNodes = useNodeStore((state) => state.setNodes)
  const setEdges = useNodeStore((state) => state.setEdges)
  const setWorkflowId = useNodeStore((state) => state.setWorkflowId)
  const nodes = useNodeStore((state) => state.nodes)
  const edges = useNodeStore((state) => state.edges)
  const clearPanel = useNodeStore((state) => state.clearPanel)

  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [workflowList, setWorkflowList] = useState<{ name: string }[]>([])
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')
  const [exportJson, setExportJson] = useState('')

  const buildExportJson = () => {
    const data: WorkflowData = { nodes, edges }
    return JSON.stringify(data, null, 2)
  }

  const doImport = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr)
      if (!data.nodes || !Array.isArray(data.nodes)) {
        setImportError('缺少 nodes 字段')
        return
      }
      if (!data.edges || !Array.isArray(data.edges)) {
        setImportError('缺少 edges 字段')
        return
      }
      for (const n of data.nodes) {
        if (!n.id || !n.type || !n.position) {
          setImportError('节点数据不完整，需要 id/type/position')
          return
        }
      }
      setImportError('')
      setNodes(data.nodes)
      setEdges(data.edges)
      setWorkflowId(data.id || data.name || `imported_${Date.now()}`)
      message.success(
        `已导入 ${data.nodes.length} 个节点, ${data.edges.length} 条连线`,
      )
      setImportOpen(false)
      setImportJson('')
    } catch (err: any) {
      setImportError(`JSON 解析错误: ${err.message}`)
    }
  }

  const handleFile = (file: RcFile) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setImportJson(text)
      doImport(text)
    }
    reader.readAsText(file)
    return false
  }

  const handleExportDownload = () => {
    const json = exportJson || buildExportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workflow-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('工作流已下载')
  }

  // 打开保存弹窗时加载已有工作流列表
  useEffect(() => {
    if (saveOpen) {
      fetch('/api/workflows')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setWorkflowList(Array.isArray(data) ? data : []))
        .catch(() => setWorkflowList([]))
    }
  }, [saveOpen])

  const handleSaveTemplate = async () => {
    if (!saveName.trim()) {
      message.warning('请输入工作流名称')
      return
    }
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          nodes,
          edges,
        }),
      })
      if (res.ok) {
        message.success(`工作流模板「${saveName}」已保存`)
        setSaveOpen(false)
        setSaveName('')
      } else {
        const err = await res.json()
        message.error('保存失败: ' + (err.error || '未知错误'))
      }
    } catch (err: any) {
      message.error('保存失败: ' + err.message)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制到剪贴板')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      message.success('已复制到剪贴板')
    }
  }

  const openExport = () => {
    setExportJson(buildExportJson())
    setExportOpen(true)
  }

  const btns = [
    {
      key: 'clearPanel',
      label: '清空面板',
      icon: <BrushCleaning style={iconStyle} />,
      onClick: clearPanel,
    },
    {
      key: 'import',
      label: '导入工作流',
      icon: <UploadIcon style={iconStyle} />,
      onClick: () => setImportOpen(true),
    },
    {
      key: 'export',
      label: '导出工作流',
      icon: <Download style={iconStyle} />,
      onClick: openExport,
    },
    {
      key: 'save',
      label: '保存工作流模板',
      icon: <Save style={iconStyle} />,
      onClick: () => setSaveOpen(true),
    },
  ]

  return (
    <>
      <Panel {...props}>
        {btns.map((item) => (
          <Tooltip key={item.key} title={item.label}>
            <Button
              shape="circle"
              icon={item.icon}
              type="default"
              onClick={item.onClick}
              className={styles.toolBtn}
            />
          </Tooltip>
        ))}
      </Panel>

      {/* 导入弹窗 */}
      <Modal
        title="导入工作流"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false)
          setImportJson('')
          setImportError('')
        }}
        footer={null}
        width={520}
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong>方式一：粘贴 JSON</Text>
        </div>
        <TextArea
          rows={8}
          placeholder={
            '在此粘贴工作流 JSON...\n格式: { "nodes": [...], "edges": [...] }'
          }
          value={importJson}
          onChange={(e) => {
            setImportJson(e.target.value)
            setImportError('')
          }}
        />
        {importError && (
          <Text
            type="danger"
            style={{ fontSize: 12, marginTop: 4, display: 'block' }}
          >
            {importError}
          </Text>
        )}
        <Button
          type="primary"
          style={{ marginTop: 8 }}
          onClick={() => doImport(importJson)}
          disabled={!importJson.trim()}
        >
          导入
        </Button>

        <div style={{ margin: '16px 0 8px' }}>
          <Text strong>方式二：上传 JSON 文件</Text>
        </div>
        <Upload.Dragger
          accept=".json"
          showUploadList={false}
          beforeUpload={handleFile}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽 JSON 文件到此区域</p>
          <p className="ant-upload-hint">支持 .json 格式的工作流文件</p>
        </Upload.Dragger>
      </Modal>

      {/* 导出弹窗 */}
      <Modal
        title="导出工作流"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        footer={null}
        width={520}
      >
        <div
          style={{
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text strong>工作流 JSON</Text>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(exportJson)}
          >
            复制
          </Button>
        </div>
        <TextArea
          rows={10}
          value={exportJson}
          readOnly
          style={{ fontFamily: 'monospace', fontSize: 11 }}
        />
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          style={{ marginTop: 12 }}
          onClick={handleExportDownload}
          block
        >
          下载为 JSON 文件
        </Button>
      </Modal>

      {/* 保存模板弹窗 */}
      <Modal
        title="保存工作流模板"
        open={saveOpen}
        onCancel={() => {
          setSaveOpen(false)
          setSaveName('')
        }}
        onOk={handleSaveTemplate}
        okText="保存"
        okButtonProps={{ disabled: !saveName.trim() }}
        width={440}
      >
        <div style={{ marginBottom: 8 }}>
          <Text>工作流名称</Text>
        </div>
        <AutoComplete
          placeholder="请输入工作流模板名称"
          value={saveName}
          onChange={(value) => setSaveName(value)}
          onSelect={(value) => setSaveName(value)}
          options={workflowList.map((item) => ({
            value: item.name,
            label: item.name,
          }))}
          style={{ width: '100%' }}
          autoFocus
        />
      </Modal>
    </>
  )
}
