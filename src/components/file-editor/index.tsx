import {
  Button,
  message,
  Space,
  Typography,
  Spin,
  Dropdown,
  Modal,
  Input,
} from 'antd'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  ReloadOutlined,
  SaveOutlined,
  FolderOutlined,
  FileOutlined,
  FolderAddOutlined,
  FileAddOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

import { useRouteStore } from '#/store/route'

const { Text, Title } = Typography

interface FileGroup {
  title: string
  files: {
    name: string
    path: string
    relativePath: string
    language: string
  }[]
}

interface FileContent {
  content: string
  language: string
  path: string
}

const languageMap: Record<string, any> = {
  json,
  markdown,
}

/** 根据语言名获取 CodeMirror Extension */
function getLangExt(language: string) {
  const fn = languageMap[language]
  return fn ? fn() : undefined
}

// 自定义树节点组件，完全替代 Ant Design Tree，避免 DOM 复制 bug
interface TreeNodeItem {
  key: string
  name: string
  icon: React.ReactNode
  isLeaf: boolean
  children?: TreeNodeItem[]
  /** 右键菜单目标路径 */
  contextPath: string
}

interface FileTreeProps {
  nodes: TreeNodeItem[]
  selectedKey?: string
  onSelect: (key: string) => void
  onRename: (path: string) => void
}

const TreeNodeRow = React.memo<{
  node: TreeNodeItem
  depth: number
  selectedKey?: string
  onSelect: (key: string) => void
  onRename: (path: string) => void
}>(({ node, depth, selectedKey, onSelect, onRename }) => {
  const [expanded, setExpanded] = useState(true)

  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedKey === node.key

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) setExpanded((v) => !v)
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'rename',
      label: '重命名',
      onClick: () => onRename(node.contextPath),
    },
  ]

  return (
    <>
      <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
        <div
          onClick={handleToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 0',
            cursor: 'pointer',
            userSelect: 'none',
            background: isSelected ? 'rgba(24,144,255,0.2)' : 'transparent',
            borderRadius: 4,
            paddingLeft: depth * 18,
            fontSize: 13,
          }}
          onDoubleClick={() => {
            if (node.isLeaf) onSelect(node.key)
          }}
        >
          {/* expand/collapse icon for directories */}
          <span
            onClick={handleToggle}
            style={{
              width: 16,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              visibility: hasChildren ? 'visible' : 'hidden',
              fontSize: 10,
              color: '#888',
              flexShrink: 0,
            }}
          >
            {expanded ? '▼' : '▶'}
          </span>
          {/* folder/file icon */}
          <span style={{ flexShrink: 0, lineHeight: 1, fontSize: 14, color: hasChildren ? '#faad14' : '#69b1ff' }}>
            {node.icon}
          </span>
          {/* name */}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: node.isLeaf ? '#ccc' : '#e8e8e8',
            }}
            onClick={() => {
              if (node.isLeaf) onSelect(node.key)
              else handleToggle
            }}
          >
            {node.name}
          </span>
        </div>
      </Dropdown>
      {/* children */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeRow
              key={child.key}
              node={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </>
  )
})

const FileTree = React.memo<FileTreeProps>(({ nodes, selectedKey, onSelect, onRename }) => {
  return (
    <div style={{ overflow: 'auto', maxHeight: '100%' }}>
      {nodes.map((node) => (
        <TreeNodeRow
          key={node.key}
          node={node}
          depth={0}
          selectedKey={selectedKey}
          onSelect={onSelect}
          onRename={onRename}
        />
      ))}
    </div>
  )
})

export const FileEditor = () => {
  const [groups, setGroups] = useState<FileGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFile, setActiveFile] = useState<FileContent | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef('')
  const { pendingFilePath, consumePendingFile } = useRouteStore()

  // 创建目录/文件 modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createType, setCreateType] = useState<'file' | 'directory'>('file')
  const [createPath, setCreatePath] = useState('')
  const [creating, setCreating] = useState(false)

  // 重命名 modal
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{
    relativePath: string
    name: string
  } | null>(null)
  const [renameName, setRenameName] = useState('')

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/editor/list')
      const data = await res.json()
      if (data.status === 'success') {
        setGroups(data.data)
      }
    } catch (err: any) {
      message.error('加载文件列表失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  // 有 pendingFilePath 时自动打开文件
  useEffect(() => {
    if (pendingFilePath) {
      handleSelect(pendingFilePath)
      consumePendingFile()
    }
  }, [pendingFilePath])

  const handleSelect = async (relativePath: string) => {
    setFileLoading(true)
    try {
      const res = await fetch(
        `/api/editor/content?path=${encodeURIComponent(relativePath)}`,
      )
      const data = await res.json()
      if (data.status === 'success') {
        setActiveFile(data.data)
        contentRef.current = data.data.content
        setDirty(false)
      }
    } catch (err: any) {
      message.error('加载文件失败: ' + err.message)
    } finally {
      setFileLoading(false)
    }
  }

  const handleSave = async () => {
    if (!activeFile) return
    const currentContent =
      viewRef.current?.state.doc.toString() ?? contentRef.current

    setSaving(true)
    try {
      const res = await fetch('/api/editor/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activeFile.path,
          content: currentContent,
        }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        message.success('已保存')
        contentRef.current = currentContent
        setDirty(false)
      } else {
        message.error(data.error || '保存失败')
      }
    } catch (err: any) {
      message.error('保存失败: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // 初始化/更新 CodeMirror
  useEffect(() => {
    if (!editorRef.current || !activeFile || fileLoading) return

    // 销毁旧 editor
    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    const langExt = getLangExt(activeFile.language)

    const state = EditorState.create({
      doc: activeFile.content,
      extensions: [
        basicSetup,
        oneDark,
        langExt ? langExt : [],
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDirty(true)
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ].flat(),
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [activeFile?.path, activeFile?.content, fileLoading])

  // --- 创建目录/文件 ---
  const openCreateModal = (type: 'file' | 'directory') => {
    setCreateType(type)
    setCreatePath('')
    setCreateModalOpen(true)
  }

  const handleCreate = async () => {
    if (!createPath.trim()) return
    setCreating(true)
    try {
      const action = createType === 'directory' ? 'mkdir' : 'createFile'
      const res = await fetch('/api/editor/fs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, path: createPath.trim() }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        message.success(
          createType === 'directory' ? '目录已创建' : '文件已创建',
        )
        setCreateModalOpen(false)
        fetchList()
      } else {
        message.error(data.error || '创建失败')
      }
    } catch (err: any) {
      message.error(`创建失败: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  // --- 重命名 ---
  const openRenameModal = (relativePath: string) => {
    const name = relativePath.split('/').pop() || relativePath
    setRenameTarget({ relativePath, name })
    setRenameName(name)
    setRenameModalOpen(true)
  }

  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return
    const parts = renameTarget.relativePath.split('/')
    parts[parts.length - 1] = renameName.trim()
    const newRelativePath = parts.join('/')

    try {
      const res = await fetch('/api/editor/fs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          path: renameTarget.relativePath,
          newPath: newRelativePath,
        }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        message.success('已重命名')
        setRenameModalOpen(false)
        // 更新 activeFile 路径（兼容文件和目录重命名）
        if (activeFile) {
          const oldPath = renameTarget.relativePath
          if (activeFile.path === oldPath) {
            // 文件重命名
            setActiveFile({ ...activeFile, path: newRelativePath })
          } else if (activeFile.path.startsWith(oldPath + '/')) {
            // 目录重命名 - activeFile 位于被重命名的目录下
            const newActivePath =
              newRelativePath + activeFile.path.slice(oldPath.length)
            setActiveFile({ ...activeFile, path: newActivePath })
          }
        }
        fetchList()
      } else {
        message.error(data.error || '重命名失败')
      }
    } catch (err: any) {
      message.error(`重命名失败: ${err.message}`)
    }
  }

  /** 将路径分割后构建嵌套树节点 */
  const makeTreeFromFiles = (files: FileGroup['files']): TreeNodeItem[] => {
    // 收集所有文件路径构建目录树，同时记录叶子文件信息
    type DirNode = {
      __dirPath: string
      __children: Record<string, DirNode | { __file: FileGroup['files'][0] }>
    }
    const root: DirNode = { __dirPath: '', __children: {} }

    for (const file of files) {
      const parts = file.relativePath.split('/')
      let current = root
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i]
        if (!(seg in current.__children)) {
          current.__children[seg] = {
            __dirPath: parts.slice(0, i + 1).join('/'),
            __children: {},
          }
        }
        current = current.__children[seg] as DirNode
      }
      const fileName = parts[parts.length - 1]
      current.__children[fileName] = { __file: file }
    }

    function buildNodes(obj: DirNode | { __file: any }): TreeNodeItem[] {
      if ('__file' in obj) return []

      const nodes: TreeNodeItem[] = []
      const dirs: [string, DirNode][] = []
      const fileEntries: [string, { __file: any }][] = []

      for (const [name, val] of Object.entries(obj.__children)) {
        if ('__children' in val) {
          dirs.push([name, val])
        } else {
          fileEntries.push([name, val])
        }
      }

      // 按名称排序
      dirs.sort(([a], [b]) => a.localeCompare(b))
      fileEntries.sort(([a], [b]) => a.localeCompare(b))

      for (const [name, val] of dirs) {
        const dirPath = val.__dirPath
        nodes.push({
          key: `dir-${dirPath}`,
          name,
          icon: <FolderOutlined />,
          isLeaf: false,
          contextPath: dirPath,
          children: buildNodes(val),
        })
      }

      for (const [, val] of fileEntries) {
        const fileInfo = val.__file
        nodes.push({
          key: fileInfo.relativePath,
          name: fileInfo.name,
          icon: <FileOutlined />,
          isLeaf: true,
          contextPath: fileInfo.relativePath,
        })
      }

      return nodes
    }

    return buildNodes(root)
  }

  // 树节点数据，仅在 groups 变化时更新
  const [treeData, setTreeData] = useState<TreeNodeItem[]>([])

  useEffect(() => {
    const data = groups.map((group, gi) => {
      return {
        key: `group-${gi}`,
        name: group.title,
        icon: <FolderOutlined />,
        isLeaf: false,
        contextPath: '',
        children: makeTreeFromFiles(group.files),
      }
    })
    setTreeData(data)
  }, [groups])

  const handleTreeSelect = useCallback((key: string) => {
    if (!key.startsWith('group-') && !key.startsWith('dir-')) {
      handleSelect(key)
    }
  }, [])

  const handleTreeRename = useCallback((path: string) => {
    openRenameModal(path)
  }, [])

  return (
    <div
      style={{
        padding: '16px 0',
        boxSizing: 'border-box',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        width: '100%',
      }}
    >
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          文件编辑器
        </Title>
        <Space>
          {activeFile && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {activeFile.path}
            </Text>
          )}
          {dirty && (
            <Text type="warning" style={{ color: '#faad14', fontSize: 11 }}>
              未保存
            </Text>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchList}
            loading={loading}
          ></Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!dirty}
          ></Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* 左侧文件树 */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            overflow: 'auto',
            border: '1px solid #333',
            borderRadius: 6,
            padding: 8,
          }}
        >
          {/* 文件树 header */}
          <div
            style={{
              marginBottom: 8,
              display: 'flex',
              gap: 4,
              justifyContent: 'flex-end',
            }}
          >
            <Button
              size="small"
              icon={<FolderAddOutlined />}
              onClick={() => openCreateModal('directory')}
            ></Button>
            <Button
              size="small"
              icon={<FileAddOutlined />}
              onClick={() => openCreateModal('file')}
            ></Button>
          </div>
          <Spin spinning={loading}>
            {treeData.length > 0 ? (
              <FileTree
                nodes={treeData}
                selectedKey={activeFile?.path}
                onSelect={handleTreeSelect}
                onRename={handleTreeRename}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                <Text type="secondary">无可编辑文件</Text>
              </div>
            )}
          </Spin>
        </div>

        {/* 右侧编辑器 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #333',
            borderRadius: 6,
            overflow: 'hidden',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          {activeFile ? (
            <Spin spinning={fileLoading} style={{ flex: 1 }}>
              <div
                ref={editorRef}
                style={{ height: '100%', overflow: 'auto' }}
              />
            </Spin>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text type="secondary">从左侧选择一个文件进行编辑</Text>
            </div>
          )}
        </div>
      </div>

      {/* 创建目录/文件 Modal */}
      <Modal
        title={createType === 'directory' ? '创建目录' : '创建文件'}
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="创建"
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            输入相对于项目根目录的路径
            {createType === 'directory'
              ? '（例如: workflows/skills/my-skill）'
              : '（例如: workflows/skills/my-skill/skill.md）'}
          </Text>
        </div>
        <Input
          placeholder={
            createType === 'directory'
              ? '例如: workflows/skills/my-skill'
              : '例如: workflows/skills/my-skill/skill.md'
          }
          value={createPath}
          onChange={(e) => setCreatePath(e.target.value)}
        />
      </Modal>

      {/* 重命名 Modal */}
      <Modal
        title="重命名"
        open={renameModalOpen}
        onCancel={() => setRenameModalOpen(false)}
        onOk={handleRename}
        okText="重命名"
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            输入新名称
            {renameTarget && (
              <span style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
                当前: {renameTarget.relativePath}
              </span>
            )}
          </Text>
        </div>
        <Input
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
        />
      </Modal>
    </div>
  )
}
