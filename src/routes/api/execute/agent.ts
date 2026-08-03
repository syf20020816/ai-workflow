import { createFileRoute } from '@tanstack/react-router'
import { callAI } from '#/services/ai'

/**
 * Agent 节点执行 API
 * 调用 AI 模型 API（统一走 Vercel AI SDK，自动兼容 Chat Completions / Responses API）
 */

export const Route = createFileRoute('/api/execute/agent')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { model, messages, systemPrompt, temperature = 0.3, tools } = body

        if (!model?.url || !model?.modelName) {
          return Response.json(
            { error: '模型配置不完整，缺少 url 或 modelName' },
            { status: 400 },
          )
        }

        const logs: string[] = []
        logs.push(`调用模型: ${model.modelName}`)
        logs.push(`API URL: ${model.url}`)
        if (tools) {
          logs.push(`工具定义: ${tools.length} 个工具（统一服务暂不支持原始工具透传，将忽略）`)
        }

        try {
          const result = await callAI({
            model: {
              name: model.modelName,
              key: model.apiKey,
              url: model.url,
              token: model.token,
            },
            systemPrompt,
            messages,
            temperature,
          })

          logs.push(`AI 响应完成 (tokens: ${result.usage?.totalTokens || 'unknown'})`)

          return Response.json({
            status: 'success',
            output: {
              response: result.text,
              model: model.modelName,
              usage: result.usage,
            },
            logs,
          })
        } catch (err: any) {
          logs.push(`调用异常: ${err.message}`)
          return Response.json({
            status: 'error',
            output: {},
            logs,
            error: `AI API 调用异常: ${err.message}`,
          })
        }
      },
    },
  },
})
