import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'

const MEMORY_DIR = path.resolve(process.cwd(), 'memory')
const MEMORY_FILE = path.join(MEMORY_DIR, 'memory.md')

/**
 * 记忆管理 API
 * 
 * GET  /api/memory   - 获取记忆文件内容
 * POST /api/memory   - 保存记忆文件内容
 */

export const Route = createFileRoute('/api/memory')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await fs.mkdir(MEMORY_DIR, { recursive: true })
        } catch { /* ignore */ }

        try {
          const content = await fs.readFile(MEMORY_FILE, 'utf-8')
          return Response.json({ status: 'success', data: { content } })
        } catch {
          return Response.json({ status: 'success', data: { content: '' } })
        }
      },

      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { content } = body

        if (content === undefined) {
          return Response.json({ status: 'error', error: '缺少 content' })
        }

        await fs.mkdir(MEMORY_DIR, { recursive: true })
        await fs.writeFile(MEMORY_FILE, content, 'utf-8')

        return Response.json({ status: 'success', message: '已保存' })
      },
    },
  },
})
