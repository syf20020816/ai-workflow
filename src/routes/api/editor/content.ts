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
 * 编辑器文件内容 API
 * 
 * GET  /api/editor/content?path=...  - 读取文件内容
 * POST /api/editor/content           - 保存文件内容
 */
export const Route = createFileRoute('/api/editor/content')({
  server: {
    handlers: {
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const relativePath = url.searchParams.get('path')

        if (!relativePath) {
          return Response.json({ status: 'error', error: '缺少 path 参数' })
        }

        const filePath = path.join(WORKSPACE, relativePath)
        if (!isPathSafe(filePath)) {
          return Response.json({ status: 'error', error: '路径安全校验失败' })
        }

        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const ext = path.extname(filePath).toLowerCase()
          const language = ext === '.json' ? 'json' : ext === '.md' ? 'markdown' : 'text'

          return Response.json({
            status: 'success',
            data: { content, language, path: relativePath },
          })
        } catch (err: any) {
          return Response.json({ status: 'error', error: `读取失败: ${err.message}` })
        }
      },

      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { path: relativePath, content } = body

        if (!relativePath || content === undefined) {
          return Response.json({ status: 'error', error: '缺少 path 或 content' })
        }

        const filePath = path.join(WORKSPACE, relativePath)
        if (!isPathSafe(filePath)) {
          return Response.json({ status: 'error', error: '路径安全校验失败' })
        }

        try {
          await fs.writeFile(filePath, content, 'utf-8')
          return Response.json({ status: 'success', message: '已保存' })
        } catch (err: any) {
          return Response.json({ status: 'error', error: `保存失败: ${err.message}` })
        }
      },
    },
  },
})
