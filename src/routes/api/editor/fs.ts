import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE = path.resolve(process.cwd())

/** 安全校验：确保路径在 workspace 内 */
function isPathSafe(targetPath: string): boolean {
  const resolved = path.resolve(targetPath)
  return resolved.startsWith(WORKSPACE) && !targetPath.includes('..')
}

/**
 * 编辑器文件系统操作 API
 *
 * POST /api/editor/fs - 文件系统操作（创建目录、创建文件、重命名）
 */
export const Route = createFileRoute('/api/editor/fs')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { action, path: relativePath, newPath } = body

        if (!action || !relativePath) {
          return Response.json({ status: 'error', error: '缺少 action 或 path 参数' })
        }

        if (!isPathSafe(path.join(WORKSPACE, relativePath))) {
          return Response.json({ status: 'error', error: '路径安全校验失败' })
        }

        if (newPath && !isPathSafe(path.join(WORKSPACE, newPath))) {
          return Response.json({ status: 'error', error: '新路径安全校验失败' })
        }

        const fullPath = path.join(WORKSPACE, relativePath)

        try {
          switch (action) {
            case 'mkdir': {
              await fs.mkdir(fullPath, { recursive: true })
              return Response.json({ status: 'success', message: '目录已创建' })
            }

            case 'createFile': {
              const dir = path.dirname(fullPath)
              await fs.mkdir(dir, { recursive: true })
              await fs.writeFile(fullPath, body.content || '', 'utf-8')
              return Response.json({ status: 'success', message: '文件已创建' })
            }

            case 'rename': {
              if (!newPath) {
                return Response.json({ status: 'error', error: '缺少新路径' })
              }
              const newFullPath = path.join(WORKSPACE, newPath)
              const newDir = path.dirname(newFullPath)
              await fs.mkdir(newDir, { recursive: true })
              await fs.rename(fullPath, newFullPath)
              return Response.json({ status: 'success', message: '已重命名' })
            }

            default:
              return Response.json({ status: 'error', error: `未知操作: ${action}` })
          }
        } catch (err: any) {
          return Response.json({ status: 'error', error: `操作失败: ${err.message}` })
        }
      },
    },
  },
})
