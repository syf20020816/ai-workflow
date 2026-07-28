import { createFileRoute } from '@tanstack/react-router'
import { getEmbeddings } from '#/services/embedding'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const EMBED_BATCH_SIZE = 8
const UPSERT_BATCH_SIZE = 20
const DEFAULT_CHUNK_SIZE = 800
const DEFAULT_CHUNK_OVERLAP = 100

function chunkText(text: string, size: number, overlap: number): string[] {
  if (!text || size <= 0) return []
  if (text.length <= size) return [text.trim()]

  const chunks: string[] = []
  let start = 0
  const maxChunks = 10000 // 安全上限，防止异常情况下无限分块

  while (start < text.length && chunks.length < maxChunks) {
    const end = Math.min(start + size, text.length)
    let chunk = text.slice(start, end)

    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('。')
      const lastNewline = chunk.lastIndexOf('\n')
      const lastSpace = chunk.lastIndexOf(' ')
      const splitAt = Math.max(lastPeriod, lastNewline, lastSpace)
      if (splitAt > size * 0.5) {
        chunk = text.slice(start, start + splitAt + 1)
      }
    }

    const trimmed = chunk.trim()
    if (trimmed.length > 0) {
      chunks.push(trimmed)
    }

    const advance = Math.max(chunk.length - overlap, 1)
    start += advance
    if (start >= text.length) break
  }

  return chunks
}

/**
 * 边 embedding 边写入 Qdrant，避免所有向量同时存在内存里
 */
async function processAndUpsertBatches(
  chunks: string[],
  collectionName: string,
  baseUrl: string,
  fileName: string,
  logs: string[],
  modelId?: string,
): Promise<number> {
  let totalWritten = 0
  let pointId = Date.now()

  for (let batchStart = 0; batchStart < chunks.length; batchStart += EMBED_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + EMBED_BATCH_SIZE, chunks.length)
    const batchChunks = chunks.slice(batchStart, batchEnd)
    const batchIndex = Math.floor(batchStart / EMBED_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(chunks.length / EMBED_BATCH_SIZE)

    logs.push(`  批次 ${batchIndex}/${totalBatches}: 向量化 ${batchChunks.length} 个块...`)

    // Step A: embedding 一批
    const embedResult = await getEmbeddings(batchChunks, modelId)
    const vectors = embedResult.embeddings
    logs.push(`  批次 ${batchIndex}/${totalBatches}: embedding 完成 (${vectors.length} 个向量, ${vectors[0]?.length || 0} 维)`)

    // Step B: 构建 points 并分批写入 Qdrant
    for (let uStart = 0; uStart < vectors.length; uStart += UPSERT_BATCH_SIZE) {
      const uEnd = Math.min(uStart + UPSERT_BATCH_SIZE, vectors.length)
      const pointBatch = []

      for (let j = uStart; j < uEnd; j++) {
        const globalIndex = batchStart + j
        pointBatch.push({
          id: pointId++,
          vector: vectors[j],
          payload: {
            content: batchChunks[j],
            source: fileName,
            chunk_index: globalIndex,
            total_chunks: chunks.length,
            created_at: new Date().toISOString(),
          },
        })
      }

      const qdrantRes = await fetch(
        new URL('/api/execute/qdrant', baseUrl).href,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upsert', collectionName, points: pointBatch }),
        },
      )
      const qdrantData = await qdrantRes.json()

      if (qdrantData.status !== 'success') {
        throw new Error(`写入 Qdrant 失败 (批次 ${batchIndex}): ${qdrantData.error}`)
      }

      totalWritten += pointBatch.length
      pointBatch.length = 0
    }

    // 释放当前批次的大对象引用
    vectors.length = 0
    batchChunks.length = 0

    // 批次间停顿，给 GC 机会
    await new Promise((r) => setTimeout(r, 100))
  }

  return totalWritten
}

export const Route = createFileRoute('/api/execute/doc-process')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const {
          collectionName,
          content,
          fileName = 'unknown',
          chunkSize = DEFAULT_CHUNK_SIZE,
          chunkOverlap = DEFAULT_CHUNK_OVERLAP,
          modelId,
        } = body

        const logs: string[] = []
        logs.push(`文档处理开始: ${fileName}`)

        if (!collectionName) {
          return Response.json({ status: 'error', output: {}, logs: [...logs, '缺少 collectionName'], error: '请提供集合名称' })
        }
        if (!content) {
          return Response.json({ status: 'error', output: {}, logs: [...logs, '缺少文档内容'], error: '请提供文档内容' })
        }

        const byteSize = new TextEncoder().encode(content).length
        if (byteSize > MAX_FILE_SIZE) {
          return Response.json({
            status: 'error',
            output: {},
            logs: [...logs, `文件过大: ${(byteSize / 1024 / 1024).toFixed(1)} MB`],
            error: `文件过大 (${(byteSize / 1024 / 1024).toFixed(1)} MB)，请上传 5 MB 以内的文件`,
          })
        }

        try {
          // Step 1: 分块
          const chunks = chunkText(content, chunkSize, chunkOverlap)
          logs.push(`文档已分为 ${chunks.length} 个块`)

          if (chunks.length === 0) {
            return Response.json({ status: 'error', output: {}, logs: [...logs, '分块结果为空'], error: '文档内容无法分块' })
          }

          // Step 2: 边向量化边写入（流式，减少峰值内存）
          logs.push(`开始分批处理 (embed batch=${EMBED_BATCH_SIZE}, upsert batch=${UPSERT_BATCH_SIZE})...`)
          const totalVectors = await processAndUpsertBatches(
            chunks,
            collectionName,
            ctx.request.url,
            fileName,
            logs,
            modelId,
          )

          const totalChunks = chunks.length
          // 释放 chunks
          chunks.length = 0

          logs.push(`文档处理完成: ${totalVectors} 个向量已写入集合 "${collectionName}"`)
          return Response.json({
            status: 'success',
            output: { fileName, collectionName, totalChunks, totalVectors },
            logs,
          })
        } catch (err: any) {
          logs.push(`文档处理失败: ${err.message}`)
          if (err.stack) logs.push(`错误栈: ${err.stack.split('\n').slice(0, 5).join(' | ')}`)
          return Response.json({ status: 'error', output: {}, logs, error: `文档处理失败: ${err.message}` })
        }
      },
    },
  },
})
