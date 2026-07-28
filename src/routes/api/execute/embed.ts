import { createFileRoute } from '@tanstack/react-router'
import { getEmbeddings } from '#/services/embedding'

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

        const texts = Array.isArray(text) ? text : [text]

        try {
          const result = await getEmbeddings(texts, modelId)

          logs.push(`成功向量化 ${texts.length} 段文本，向量维度: ${result.dimensions}`)

          return Response.json({
            status: 'success',
            output: {
              embeddings: result.embeddings,
              vector: result.embeddings[0],
              dimensions: result.dimensions,
              usage: result.usage,
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
