import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import { callAI } from '#/services/ai'

/** 关键词提取 API 路由 */
export const Route = createFileRoute('/api/execute/keywordAgent')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { upstreamContent, format, modal } = body

        if (!modal?.name || !modal?.url) {
          return new Response(
            JSON.stringify({ status: 'error', error: '模型配置不完整' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (!upstreamContent) {
          return new Response(
            JSON.stringify({ status: 'error', error: '上游内容为空' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // 1. 读取 prompt 文件
        const promptPath = path.resolve(process.cwd(), 'prompts', 'keywordAgent.md')
        let systemPrompt = ''
        try {
          systemPrompt = fs.readFileSync(promptPath, 'utf-8')
        } catch {
          systemPrompt = 'Extract keywords from the text and output as JSON.'
        }

        // 2. 构建 system prompt（prompt + 用户指定的格式）
        const formatJson = format || '{\n  "keywords": string[]\n}'
        const fullSystemPrompt = `${systemPrompt}\n\nOutput format:\n\`\`\`json\n${formatJson}\`\`\``

        // 3. 调用 AI（统一服务自动适配 Chat Completions / Responses API）
        const truncatedContent = upstreamContent.slice(0, 5000)

        let content: string
        try {
          const result = await callAI({
            model: {
              name: modal.name,
              key: modal.key,
              url: modal.url,
              token: modal.token,
            },
            systemPrompt: fullSystemPrompt,
            prompt: `Extract keywords from the following text:\n\n${truncatedContent}`,
            temperature: 0.3,
          })
          content = result.text
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              status: 'error',
              error: `AI 调用失败: ${err.message}`,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // 4. 解析 JSON，提取 keywords
        let keywords: string[] = []
        let parsed: any = {}
        try {
          parsed = JSON.parse(content)
        } catch {
          // 尝试从 ```json ... ``` 块中提取
          const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[1]) } catch {}
          }
        }

        if (Array.isArray(parsed.keywords)) {
          keywords = parsed.keywords.map((k: any) => String(k)).filter(Boolean)
        } else if (Array.isArray(parsed.queries)) {
          keywords = parsed.queries.map((k: any) => String(k)).filter(Boolean)
        } else {
          // 兜底：从解析结果中找第一个数组字段
          for (const val of Object.values(parsed)) {
            if (Array.isArray(val)) {
              keywords = val.map((k: any) => String(k)).filter(Boolean)
              break
            }
          }
        }

        // 输出同时携带 keywords 和 queries 供下游知识库检索节点使用
        return new Response(
          JSON.stringify({
            status: 'success',
            output: {
              keywords,
              queries: keywords,
              raw: parsed,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
