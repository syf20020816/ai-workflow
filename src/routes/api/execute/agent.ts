import { createFileRoute } from '@tanstack/react-router'

/**
 * Agent 节点执行 API
 * 调用 AI 模型 API（兼容 Chat Completions / Responses API 双协议）
 */

/** 从 Chat Completions 响应中提取文本 */
function extractChatCompletionText(data: any): string {
  return data.choices?.[0]?.message?.content || ''
}

/** 从 Responses API 响应中提取文本 */
function extractResponsesText(data: any): string {
  try {
    const msg = (data.output || []).find((o: any) => o.type === 'message')
    if (msg?.content) {
      const textBlock = msg.content.find((c: any) => c.type === 'output_text')
      if (textBlock?.text) return textBlock.text
    }
  } catch {}
  return ''
}

/** 统一提取 usage 信息（兼容两种 API 的字段命名差异） */
function extractUsage(data: any): { promptTokens: number; completionTokens: number; totalTokens: number } | undefined {
  if (!data.usage) return undefined
  const u = data.usage
  return {
    promptTokens: u.prompt_tokens ?? u.input_tokens ?? 0,
    completionTokens: u.completion_tokens ?? u.output_tokens ?? 0,
    totalTokens: u.total_tokens ?? (u.prompt_tokens ?? u.input_tokens ?? 0) + (u.completion_tokens ?? u.output_tokens ?? 0),
  }
}

/** 检测是否为 Responses API（URL 路径含 /responses） */
function isResponsesApi(url: string): boolean {
  return url.includes('/responses')
}

/** 构建 Chat Completions 请求体 */
function buildChatCompletionsBody(model: any, messages: any[], systemPrompt: string, temperature: number, tools?: any[], toolChoice?: string): Record<string, any> {
  const requestBody: Record<string, any> = {
    model: model.modelName,
    temperature: temperature ?? 0.3,
  }

  // 如果有工具定义，直接使用传入的完整 messages（含 tool 结果回传），
  // 否则由函数自己构建 messages 数组
  if (tools) {
    requestBody.messages = messages
    requestBody.tools = tools
    if (toolChoice) {
      requestBody.tool_choice = toolChoice
    }
  } else {
    requestBody.messages = []
    if (systemPrompt) {
      requestBody.messages.push({ role: 'system', content: systemPrompt })
    }
    for (const msg of messages || []) {
      requestBody.messages.push(msg)
    }
    if (requestBody.messages.length === 0) {
      requestBody.messages.push({
        role: 'user',
        content: '请处理...',
      })
    }
  }

  // Token 限制
  if (model.token?.max) {
    requestBody.max_tokens = model.token.max
    if (model.url && (model.url.includes('localhost') || model.url.includes('127.0.0.1'))) {
      requestBody.options = { num_ctx: Math.max(model.token.max, 4096) }
    }
  }

  return requestBody
}

/** 构建 Responses API 请求体（火山方舟兼容：content 使用数组格式） */
function buildResponsesBody(model: any, messages: any[], systemPrompt: string, temperature: number): Record<string, any> {
  const requestBody: Record<string, any> = {
    model: model.modelName,
    input: [],
  }

  // Responses API 支持 temperature
  if (temperature !== undefined) {
    requestBody.temperature = temperature
  }

  // 将 plain string content 转为 Volcengine 要求的数组格式 [{type: "input_text", text: "..."}]
  const toContentArray = (content: string): any[] => {
    if (!content) return []
    // 如果已经是数组格式，直接返回（兼容外层传入的消息）
    return [{ type: 'input_text', text: content }]
  }

  // systemPrompt → input 中的 system 消息
  if (systemPrompt) {
    requestBody.input.push({ role: 'system', content: toContentArray(systemPrompt) })
  }

  // 用户消息：统一 content 为数组格式
  for (const msg of messages || []) {
    const formatted = { ...msg }
    if (typeof formatted.content === 'string') {
      formatted.content = toContentArray(formatted.content)
    }
    requestBody.input.push(formatted)
  }

  // 空消息兜底
  if (requestBody.input.length === 0) {
    requestBody.input.push({
      role: 'user',
      content: toContentArray('请处理...'),
    })
  }

  // Token 限制：Volcengine Responses API 不兼容此参数，跳过
  // Responses API 的原生 OpenAI 实现支持 max_completion_tokens

  return requestBody
}

export const Route = createFileRoute('/api/execute/agent')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { model, messages, systemPrompt, temperature = 0.3, tools, toolChoice } = body

        if (!model?.url || !model?.modelName) {
          return Response.json(
            { error: '模型配置不完整，缺少 url 或 modelName' },
            { status: 400 },
          )
        }

        const logs: string[] = []
        const isResponses = isResponsesApi(model.url)
        logs.push(`调用模型: ${model.modelName}`)
        logs.push(`API URL: ${model.url}`)
        logs.push(`API 类型: ${isResponses ? 'Responses API' : 'Chat Completions'}`)
        if (tools) {
          logs.push(`工具定义: ${tools.length} 个工具`)
        }

        try {
          // Chat Completions 支持 tools，Responses API 不支持
          const hasTools = !isResponses && !!tools

          // 构造请求体
          const requestBody = isResponses
            ? buildResponsesBody(model, messages, systemPrompt, temperature)
            : buildChatCompletionsBody(model, messages, systemPrompt, temperature, hasTools ? tools : undefined, toolChoice)

          logs.push(`请求体摘要: model=${requestBody.model}, input/messages 共 ${((requestBody.input || requestBody.messages)?.length || 0)} 条`)
          logs.push(`API Key 状态: ${model.apiKey ? `已设置 (${model.apiKey.slice(0, 8)}...)` : '未设置'}`)
          if (isResponses) {
            const sample = JSON.stringify(requestBody).slice(0, 300)
            logs.push(`请求体预览: ${sample}...`)
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (model.apiKey) {
            headers['Authorization'] = `Bearer ${model.apiKey}`
          }

          // 构造 API URL
          let apiUrl = model.url.replace(/\/+$/, '')
          const hasChatPath = apiUrl.includes('/chat/completions')
          const hasResponsesPath = apiUrl.includes('/responses')
          if (!hasChatPath && !hasResponsesPath) {
            apiUrl += '/v1/chat/completions'
          }

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

          // 检查是否有 tool_calls（函数调用）
          const toolCalls = data.choices?.[0]?.message?.tool_calls
          const content = toolCalls
            ? ''  // 有 tool_calls 时 content 通常为 null
            : (isResponses ? extractResponsesText(data) : extractChatCompletionText(data))

          const usage = extractUsage(data)

          if (toolCalls) {
            logs.push(`AI 返回 ${toolCalls.length} 个工具调用`)
          } else {
            logs.push(`AI 响应完成 (tokens: ${usage?.totalTokens || 'unknown'})`)
          }

          return Response.json({
            status: 'success',
            output: {
              response: content,
              model: model.modelName,
              usage,
              toolCalls: toolCalls || undefined,
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
