import { createFileRoute } from '@tanstack/react-router'
import { execSync } from 'node:child_process'

/**
 * Lark 文档执行 API
 * 调用 lark-cli 执行读/写/创建操作
 */
export const Route = createFileRoute('/api/execute/lark')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { action, url, content } = body

        const logs: string[] = []
        logs.push(`Lark 操作: ${action}`)

        try {
          let cmd = ''

          switch (action) {
            case 'read':
              cmd = `lark-cli docs +fetch --doc "${url}" --doc-format markdown --format json`
              break
            case 'write':
              cmd = `lark-cli docs +update --doc "${url}" --command append --doc-format markdown --content "${(content || '').replace(/"/g, '\\"')}" --format json`
              break
            case 'create':
              cmd = `lark-cli docs +create --doc-format markdown --content "${(content || '新建文档').replace(/"/g, '\\"')}" --format json`
              break
            default:
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, `未知操作: ${action}`],
                error: `未知操作类型: ${action}`,
              })
          }

          logs.push(`执行命令: ${cmd.slice(0, 120)}...`)
          const stdout = execSync(cmd, {
            encoding: 'utf-8',
            timeout: 30000,
          })

          const result = JSON.parse(stdout)

          if (result.ok === false) {
            logs.push(`操作失败: ${result.error?.message || '未知错误'}`)
            return Response.json({
              status: 'error',
              output: { result: stdout, action, url },
              logs,
              error: result.error?.message || 'Lark 操作失败',
            })
          }

          logs.push(`${action} 操作成功`)

          return Response.json({
            status: 'success',
            output: {
              result: stdout,
              action,
              url,
              success: true,
            },
            logs,
          })
        } catch (err: any) {
          const stderr = err.stderr?.toString() || ''
          const stdout = err.stdout?.toString() || ''
          logs.push(`命令失败: ${err.message}`)
          return Response.json({
            status: 'error',
            output: {
              result: stdout || stderr || err.message,
              action,
              url,
            },
            logs,
            error: `Lark CLI 调用失败: ${err.message}`,
          })
        }
      },
    },
  },
})
