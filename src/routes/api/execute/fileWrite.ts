import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

export const Route = createFileRoute('/api/execute/fileWrite')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { filePath, content } = body

        if (!filePath) {
          return Response.json({ error: '缺少 filePath' }, { status: 400 })
        }

        try {
          // 确保目标目录存在
          const dir = path.dirname(filePath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }

          fs.writeFileSync(filePath, content || '', 'utf-8')

          return Response.json({ status: 'success', output: { filePath } })
        } catch (err: any) {
          return Response.json({
            status: 'error',
            error: `文件写入失败: ${err.message}`,
            output: { filePath },
          })
        }
      },
    },
  },
})
