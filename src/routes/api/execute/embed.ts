import { createFileRoute } from '@tanstack/react-router'
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

/**
 * Embedding API
 * 将文本转换为向量，用于 Qdrant 向量搜索
 */
export const Route = createFileRoute('/api/execute/embed')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { text, modelId } = body

        const logs: string[] = []

        if (!text) {
          return Response.json({
            status: 'error',
            output: {},
            logs: [...logs, '缺少 text'],
            error: '请提供需要向量化的文本',
          })
        }

        // 查找模型配置
        const models = readModels()
        const model = modelId
          ? models.find((m) => m.id === modelId)
          : models[0]

        if (!model || !model.url) {
          return Response.json({
            status: 'error',
            output: {},
            logs: [...logs, '未找到有效的模型配置，请先在模型管理中添加模型'],
            error: '请先配置 AI 模型（需要支持 embedding 接口）',
          })
        }

        // 默认 embedding 模型名
        const embedModel = model.modelName || 'text-embedding-ada-002'

        try {
          const apiUrl = model.url.replace(/\/+$/, '') + '/embeddings'
          logs.push(`调用 Embedding API: ${model.url}`)

          const texts = Array.isArray(text) ? text : [text]

          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
            },
            body: JSON.stringify({
              model: embedModel,
              input: texts,
            }),
          })

          if (!res.ok) {
            const errText = await res.text()
            logs.push(`Embedding API 返回错误: ${res.status}`)
            return Response.json({
              status: 'error',
              output: {},
              logs,
              error: `Embedding 调用失败: ${res.status} ${errText.slice(0, 200)}`,
            })
          }

          const data = await res.json()

          // OpenAI 兼容格式: data.data[].embedding
          const embeddings = data.data?.map((d: any) => d.embedding) || []

          logs.push(`成功向量化 ${texts.length} 段文本，向量维度: ${embeddings[0]?.length || 0}`)

          return Response.json({
            status: 'success',
            output: {
              embeddings,
              vector: embeddings[0], // 单段文本直接返回向量
              dimensions: embeddings[0]?.length || 0,
              usage: data.usage,
            },
            logs,
          })
        } catch (err: any) {
          logs.push(`Embedding 调用失败: ${err.message}`)
          return Response.json({
            status: 'error',
            output: {},
            logs,
            error: `Embedding 调用失败: ${err.message}`,
          })
        }
      },
    },
  },
})
