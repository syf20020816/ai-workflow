import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE = path.resolve(process.cwd())
const DOCS_DIR = 'docs'

interface DocNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: DocNode[]
}

/** 递归读取目录，目录优先排序，返回树结构 */
async function readTree(dirPath: string, relativeDir: string): Promise<DocNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })

  const nodes: DocNode[] = []
  for (const entry of entries) {
    const relPath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      const children = await readTree(path.join(dirPath, entry.name), relPath)
      nodes.push({
        name: entry.name,
        path: relPath.split(path.sep).join('/'),
        type: 'directory',
        children,
      })
    } else if (entry.isFile()) {
      nodes.push({
        name: entry.name,
        path: relPath.split(path.sep).join('/'),
        type: 'file',
      })
    }
  }

  // 目录在前、文件在后，各自按名称排序
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

/**
 * 文档目录树 API
 *
 * GET /api/docs/list - 递归列出 docs/ 目录结构
 */
export const Route = createFileRoute('/api/docs/list')({
  server: {
    handlers: {
      GET: async () => {
        const docsPath = path.join(WORKSPACE, DOCS_DIR)
        try {
          const data = await readTree(docsPath, DOCS_DIR)
          return Response.json({ status: 'success', data })
        } catch (err: any) {
          return Response.json({
            status: 'error',
            error: `读取 docs 目录失败: ${err.message}`,
          })
        }
      },
    },
  },
})
