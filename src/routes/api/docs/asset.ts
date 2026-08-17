import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE = path.resolve(process.cwd())

/** 安全校验：确保路径在 workspace 内 */
function isPathSafe(targetPath: string): boolean {
  const resolved = path.resolve(targetPath)
  return resolved.startsWith(WORKSPACE) && !targetPath.includes('..')
}

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

/**
 * 文档静态资源 API
 *
 * GET /api/docs/asset?path=docs/imgs/xxx.png - 读取 docs 下的图片等二进制资源
 */
export const Route = createFileRoute('/api/docs/asset')({
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
          const data = await fs.readFile(filePath)
          const ext = path.extname(filePath).toLowerCase()
          return new Response(data, {
            headers: {
              'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
              'Cache-Control': 'no-cache',
            },
          })
        } catch (err: any) {
          return Response.json(
            { status: 'error', error: `读取失败: ${err.message}` },
            { status: 404 },
          )
        }
      },
    },
  },
})
