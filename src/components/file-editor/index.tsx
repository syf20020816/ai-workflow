import { Button, message, Space, Tree, Typography, Spin } from 'antd'
import { useEffect, useState, useRef } from 'react'
import {
  ReloadOutlined,
  SaveOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons'
import type { DataNode } from 'antd/es/tree'
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

  // 构建树节点
  const treeData: DataNode[] = groups.map((group, gi) => ({
    key: `group-${gi}`,
    title: group.title,
    icon: <FolderOutlined />,
    children: group.files.map((file) => ({
      key: file.relativePath,
      title: file.name,
      icon: <FileOutlined />,
      isLeaf: true,
    })),
  }))

  // 获取当前路径对应的相对路径映射
  const fileMap = new Map<string, string>()
  for (const group of groups) {
    for (const file of group.files) {
      fileMap.set(file.name, file.relativePath)
    }
  }

  return (
    <div
      style={{
        padding: "16px 0",
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
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!dirty}
          >
            保存
          </Button>
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
          <Spin spinning={loading}>
            {treeData.length > 0 ? (
              <Tree
                treeData={treeData}
                showIcon
                defaultExpandAll
                selectedKeys={activeFile ? [activeFile.path] : []}
                onSelect={(keys) => {
                  if (keys.length > 0 && keys[0] !== `group-${keys[0]}`) {
                    handleSelect(keys[0] as string)
                  }
                }}
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
            height: "100%",
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
    </div>
  )
}
