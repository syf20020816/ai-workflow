import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

/**
 * 统一 AI 调用服务
 * 基于 Vercel AI SDK，统一走 OpenAI 兼容的 Chat Completions 接口。
 * 火山方舟 Ark（含 deepseek-v4、豆包）、Ollama、DeepSeek、OpenAI 官方等均支持，
 * 无需按平台手写适配。URL 即使配置为 /responses 也会自动归一化到 /chat/completions。
 */

/** 从模型 URL 中提取 OpenAI 兼容的 base URL（去掉 /chat/completions 或 /responses 后缀） */
export function extractBaseUrl(rawUrl: string): string {
  let url = rawUrl
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/responses\/?$/i, '')
    .replace(/\/+$/, '')
  // 仅当 URL 末尾没有 API 版本号（如 v1, v2, v3）时才补 /v1（Ollama 等需要）
  const lastSegment = url.split('/').pop() || ''
  if (!/^v\d+$/i.test(lastSegment)) {
    url += '/v1'
  }
  return url
}

export interface AICallModel {
  name: string
  key?: string
  url: string
  token?: { min?: number; max?: number }
}

export interface CallAIOptions {
  model: AICallModel
  systemPrompt?: string
  prompt?: string
  /** 对话消息（OpenAI 风格：{ role, content }），与 prompt 二选一 */
  messages?: { role: string; content: string }[]
  temperature?: number
  maxTokens?: number
  /** 额外请求体字段（如 Ollama 的 options.num_ctx），通过 fetch 中间件合并 */
  extraBody?: Record<string, any>
}

export interface CallAIResult {
  text: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

/** 统一 AI 调用入口 */
export async function callAI(options: CallAIOptions): Promise<CallAIResult> {
  const { model } = options
  const baseUrl = extractBaseUrl(model.url)

  // 本地 Ollama 需要注入 options.num_ctx 扩大上下文窗口（默认 2048 太小）
  const isLocalOllama =
    model.url.includes('localhost') || model.url.includes('127.0.0.1')
  const extraBody = { ...(options.extraBody || {}) }
  if (isLocalOllama && model.token?.max && !extraBody.options) {
    extraBody.options = { num_ctx: Math.max(model.token.max, 4096) }
  }

  const originalFetch = globalThis.fetch
  const provider = createOpenAI({
    baseURL: baseUrl,
    apiKey: model.key || '',
    ...(Object.keys(extraBody).length > 0
      ? {
          // fetch 中间件：把额外字段合并进请求体（providerOptions 是 strict schema 无法透传）
          fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
            if (init?.body) {
              try {
                const parsed = JSON.parse(String(init.body))
                init = { ...init, body: JSON.stringify({ ...parsed, ...extraBody }) }
              } catch {
                // 请求体不是 JSON，跳过
              }
            }
            return originalFetch(url, init)
          },
        }
      : {}),
  })

  // 统一使用 Chat Completions 端点（所有 OpenAI 兼容平台均支持，避免 Responses API 严格 schema 解析差异）
  const lm = provider.chat(model.name)

  const result = await generateText({
    model: lm,
    ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
    ...(options.prompt ? { prompt: options.prompt } : {}),
    ...(options.messages && options.messages.length > 0
      ? {
          messages: options.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })) as any,
        }
      : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens || model.token?.max
      ? { maxTokens: options.maxTokens ?? model.token?.max }
      : {}),
  })

  return {
    text: result.text,
    usage: result.usage
      ? {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        }
      : undefined,
  }
}
