import fs from 'node:fs'
import path from 'node:path'
import type { Model } from '#/types/model'

const MODEL_CONF_PATH = path.resolve(process.cwd(), 'model.conf.json')

function readModels(): Model[] {
  try {
    return JSON.parse(fs.readFileSync(MODEL_CONF_PATH, 'utf-8'))
  } catch {
    return []
  }
}

export interface EmbedResult {
  embeddings: number[][]
  dimensions: number
  usage?: any
}

/**
 * 猜测 embedding 端点 URL
 *   - 用户配置 base URL 本身已包含 /embeddings → 直接使用
 *   - 包含 /v1 → OpenAPI 兼容格式，拼 /embeddings，支持批量 input 数组
 *   - 本地 Ollama → 拼 /api/embeddings，单条 prompt 参数
 */
function resolveEmbedUrl(base: string): string {
  const url = base.replace(/\/+$/, '')
  if (url.endsWith('/embeddings')) return url
  if (/\/v1$/.test(url)) return url + '/embeddings'
  return url + '/api/embeddings'
}

/**
 * 判断是否为 Ollama 风格的端点（走 /api/embeddings）
 */
function isOllamaEndpoint(apiUrl: string): boolean {
  return /\/api\/embeddings$/.test(apiUrl)
}

/**
 * 解析 embedding 响应，兼容 OpenAI / Ollama 两种格式
 */
function parseEmbeddings(data: any): number[][] {
  // OpenAI 格式: { data: [{ embedding: [0.1, ...] }, ...] }
  if (data.data?.length && data.data[0]?.embedding) {
    return data.data.map((d: any) => d.embedding)
  }
  // Ollama 新格式: { embeddings: [[0.1, ...], ...] }
  if (data.embeddings?.length) {
    return data.embeddings
  }
  // Ollama 旧格式: { embedding: [0.1, ...] }（单条）
  if (data.embedding?.length) {
    return [data.embedding]
  }
  return []
}

export async function getEmbeddings(texts: string[], modelId?: string): Promise<EmbedResult> {
  const models = readModels()
  let model: Model | undefined

  if (modelId) {
    model = models.find((m) => m.id === modelId)
  } else {
    // 自动选择：优先选名称/描述含 "embedding" 的模型，其次选 Ollama 本地模型
    model = models.find((m) =>
      (m.name + m.modelName + (m.description || '')).toLowerCase().includes('embed'),
    ) || models.find((m) => /localhost|127\.0\.0\.1|ollama/i.test(m.url || '')) || models[0]
  }

  if (!model || !model.url) {
    throw new Error('请先配置 AI 模型（需要支持 embedding 接口）')
  }

  const apiUrl = resolveEmbedUrl(model.url)
  const embedModel = model.modelName || 'text-embedding-ada-002'
  const isOllama = isOllamaEndpoint(apiUrl)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    let embeddings: number[][] = []
    let usage: any = undefined

    if (isOllama) {
      // Ollama /api/embeddings：单条 prompt，逐条请求
      for (let i = 0; i < texts.length; i++) {
        const res = await fetch(apiUrl, {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
          },
          body: JSON.stringify({ model: embedModel, prompt: texts[i] }),
        })
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Ollama embedding 失败 (第 ${i + 1}/${texts.length} 条): ${res.status} ${errText.slice(0, 200)}`)
        }
        const data = await res.json()
        const list = parseEmbeddings(data)
        if (list.length === 0) {
          throw new Error(`Ollama embedding 返回为空 (第 ${i + 1} 条)`)
        }
        embeddings.push(list[0])
      }
    } else {
      // OpenAI / v1 兼容格式：支持 input 数组批量
      const res = await fetch(apiUrl, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: embedModel, input: texts }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Embedding 调用失败: ${res.status} ${errText.slice(0, 200)}`)
      }
      const data = await res.json()
      embeddings = parseEmbeddings(data)
      usage = data.usage
    }

    if (embeddings.length === 0 || !embeddings[0]?.length) {
      throw new Error('Embedding 返回为空或格式异常')
    }

    return { embeddings, dimensions: embeddings[0].length, usage }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Embedding 请求超时 (60s): ${apiUrl}`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
