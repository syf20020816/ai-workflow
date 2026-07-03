import { createFileRoute } from '@tanstack/react-router'

/**
 * Agent 节点执行 API
 * 调用 AI 模型 API（兼容 OpenAI/Anthropic/Ollama 格式）
 */
export const Route = createFileRoute('/api/execute/agent')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { model, messages, systemPrompt, temperature = 0.3 } = body

        if (!model?.url || !model?.modelName) {
          return Response.json(
            { error: '模型配置不完整，缺少 url 或 modelName' },
            { status: 400 },
          )
        }

        const logs: string[] = []
        logs.push(`调用模型: ${model.modelName}`)
        logs.push(`API URL: ${model.url}`)

        try {
          // 构造请求体 — 兼容 OpenAI API 格式
          const requestBody: Record<string, any> = {
            model: model.modelName,
            messages: [],
            temperature: temperature ?? 0.3,
          }

          if (systemPrompt) {
            requestBody.messages.push({ role: 'system', content: systemPrompt })
          }

          for (const msg of messages || []) {
            requestBody.messages.push(msg)
          }

          // 如果 messages 为空，用 input 构造默认消息
          if (requestBody.messages.length === 0) {
            requestBody.messages.push({
              role: 'user',
              content: body.input || '请处理...',
            })
          }

          // Token 限制
          if (model.token?.max) {
            requestBody.max_tokens = model.token.max
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (model.apiKey) {
            headers['Authorization'] = `Bearer ${model.apiKey}`
          }

          const apiUrl = model.url.replace(/\/+$/, '') + '/v1/chat/completions'

          const res = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
          })

          if (!res.ok) {
            const errText = await res.text()
            logs.push(`API 返回错误: ${res.status} ${errText}`)
            return Response.json({
              status: 'error',
              output: {},
              logs,
              error: `AI API 调用失败: ${res.status} ${errText.slice(0, 200)}`,
            })
          }

          const data = await res.json()
          const content = data.choices?.[0]?.message?.content || ''

          logs.push(`AI 响应完成 (tokens: ${data.usage?.total_tokens || 'unknown'})`)

          return Response.json({
            status: 'success',
            output: {
              response: content,
              model: model.modelName,
              usage: data.usage
                ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                  }
                : undefined,
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
