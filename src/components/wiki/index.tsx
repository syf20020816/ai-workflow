import React, { useCallback, useEffect, useState } from 'react'
import { Button, Spin, Typography } from 'antd'
import {
  ReloadOutlined,
  FolderOutlined,
  FileOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { MdPreview } from '#/components/file-editor/editor'
import styles from './index.module.scss'

const { Text, Title } = Typography

interface DocNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocNode[]
}

/** 文件名（不含 .md）到展示名的映射 */
const DOC_NAME_MAP: Record<string, string> = {
  detail: '深入指南',
  overview: '项目概述',
  quickstart: '快速入门',
}

/** 文件节点的展示名：去掉 .md 后缀并按映射替换 */
const getFileDisplayName = (name: string): string => {
  const base = name.endsWith('.md') ? name.slice(0, -3) : name
  return DOC_NAME_MAP[base] ?? base
}

// ---------- 递归目录树 ----------

interface TreeNodeRowProps {
  node: DocNode
  depth: number
  selectedPath?: string
  onSelect: (path: string) => void
}

const TreeNodeRow = React.memo<TreeNodeRowProps>(
  ({ node, depth, selectedPath, onSelect }) => {
    const [expanded, setExpanded] = useState(true)
    const hasChildren = node.children && node.children.length > 0
    const isSelected = selectedPath === node.path

    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (hasChildren) setExpanded((v) => !v)
    }

    const handleClick = () => {
      if (node.type === 'file') onSelect(node.path)
      else if (hasChildren) setExpanded((v) => !v)
    }

    return (
      <>
        <div
          onClick={handleClick}
          className={`${styles.treeRow}${isSelected ? ` ${styles.treeRowSelected}` : ''}`}
          style={{ ['--tree-depth' as any]: depth }}
        >
          <span
            onClick={handleToggle}
            className={`${styles.treeExpandIcon} ${
              hasChildren ? styles.treeExpandIconVisible : styles.treeExpandIconHidden
            }`}
          >
            {expanded ? '▼' : '▶'}
          </span>
          <span
            className={`${styles.treeNodeIcon} ${
              node.type === 'directory' ? styles.treeNodeIconDir : styles.treeNodeIconFile
            }`}
          >
            {node.type === 'directory' ? <FolderOutlined /> : <FileTextOutlined />}
          </span>
          <span
            className={`${styles.treeName} ${
              node.type === 'directory' ? styles.treeNameDir : styles.treeNameFile
            }`}
          >
            {node.type === 'directory' ? node.name : getFileDisplayName(node.name)}
          </span>
        </div>
        {hasChildren && expanded && (
          <div>
            {node.children!.map((child) => (
              <TreeNodeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </>
    )
  },
)

const DocTree = React.memo<{
  nodes: DocNode[]
  selectedPath?: string
  onSelect: (path: string) => void
}>(({ nodes, selectedPath, onSelect }) => (
  <div className={styles.docTree}>
    {nodes.map((node) => (
      <TreeNodeRow
        key={node.path}
        node={node}
        depth={0}
        selectedPath={selectedPath}
        onSelect={onSelect}
      />
    ))}
  </div>
))

// ---------- Wiki 页面 ----------

export const Wiki = () => {
  const [tree, setTree] = useState<DocNode[]>([])
  const [loading, setLoading] = useState(true)
  const [activePath, setActivePath] = useState<string>('')
  const [reloadTick, setReloadTick] = useState(0)

  const findFirstFile = (nodes: DocNode[]): string | null => {
    for (const node of nodes) {
      if (node.type === 'file') return node.path
      if (node.children) {
        const found = findFirstFile(node.children)
        if (found) return found
      }
    }
    return null
  }

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/docs/list')
      const data = await res.json()
      if (data.status === 'success') {
        setTree(data.data)
        setActivePath((prev) => prev || findFirstFile(data.data) || '')
      }
    } catch (err: any) {
      setTree([])
    } finally {
      setLoading(false)
    }
  }

  // 重新加载：刷新目录树并强制重挂载右侧预览，重新读取当前文档内容
  const handleReload = () => {
    fetchList()
    setReloadTick((t) => t + 1)
  }

  useEffect(() => {
    fetchList()
  }, [])

  const handleSelect = useCallback((path: string) => {
    setActivePath(path)
  }, [])

  const handleNavigate = useCallback((path: string) => {
    setActivePath(path)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.headerTitle}>
          文档
        </Title>
        {activePath && (
          <Text type="secondary" className={styles.headerPath}>
            {activePath}
          </Text>
        )}
        <Button
          icon={<ReloadOutlined />}
          onClick={handleReload}
          loading={loading}
        />
      </div>

      <div className={styles.contentArea}>
        {/* 左侧 docs 目录树 */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Text type="secondary" className={styles.sidebarTitle}>
              docs/
            </Text>
          </div>
          <Spin spinning={loading}>
            {tree.length > 0 ? (
              <DocTree
                nodes={tree}
                selectedPath={activePath}
                onSelect={handleSelect}
              />
            ) : (
              <div className={styles.emptyState}>
                <Text type="secondary">docs 目录下暂无文档</Text>
              </div>
            )}
          </Spin>
        </div>

        {/* 右侧 Markdown 预览 */}
        <div className={styles.previewContainer}>
          {activePath ? (
            <MdPreview
              key={reloadTick}
              path={activePath}
              onNavigate={handleNavigate}
            />
          ) : (
            <div className={styles.previewPlaceholder}>
              <FileOutlined className={styles.placeholderIcon} />
              <Text type="secondary">从左侧选择一篇文档阅读</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
