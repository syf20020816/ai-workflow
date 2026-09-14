import { createFileRoute } from '@tanstack/react-router'

/**
 * 知识库检索（远程 API 模式）代理路由
 *
 * 平台不内置数据库：API 模式由用户配置外部知识库接口，
 * 由本路由代理发起请求，规避浏览器跨域限制。
 * 仅允许 http/https 协议，防止探测内网地址。
 */

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const Route = createFileRoute('/api/execute/httpProxy')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { url, method = 'GET', headers = [], body: rawBody } = body

        if (!url || !isValidHttpUrl(url)) {
          return Response.json(
            { status: 'error', output: {}, error: '请求 URL 缺失或不是合法的 http/https 地址' },
            { status: 400 },
          )
        }

        const logs: string[] = []
        logs.push(`代理请求: ${method} ${url}`)

        const headerObj: Record<string, string> = {}
        for (const h of Array.isArray(headers) ? headers : []) {
          if (h?.key) headerObj[h.key] = String(h.value ?? '')
        }

        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 60_000)

          const res = await fetch(url, {
            method,
            headers: headerObj,
            body: method === 'GET' || method === 'HEAD' ? undefined : (rawBody || undefined),
            signal: controller.signal,
          })
          clearTimeout(timer)

          const text = await res.text()
          logs.push(`响应状态: ${res.status} ${res.statusText} (${text.length} 字符)`)

          let json: unknown = null
          try {
            json = JSON.parse(text)
          } catch {
            // 非 JSON 响应，保持文本
          }

          return Response.json({
            status: 'success',
            output: {
              statusCode: res.status,
              statusText: res.statusText,
              text,
              json,
              contentType: res.headers.get('content-type') || '',
            },
            logs,
          })
        } catch (err: any) {
          logs.push(`代理请求失败: ${err.message}`)
          return Response.json({
            status: 'error',
            output: {},
            logs,
            error: `外部知识库请求失败: ${err.message}`,
          })
        }
      },
    },
  },
})
