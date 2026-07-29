import { createFileRoute } from '@tanstack/react-router'

const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333'

/**
 * Qdrant 向量知识库执行 API
 * 支持操作:
 * - health: 检查 Qdrant 连接状态
 * - collections: 获取集合列表
 * - search: 向量搜索（需要前置 embedding）
 * - upsert: 写入向量点
 * - create-collection: 创建集合
 * - delete-collection: 删除集合
 * - get-points: 获取集合中的点列表
 */

async function qdrantFetch(path: string, options?: RequestInit) {
  const url = `${QDRANT_HOST}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

export const Route = createFileRoute('/api/execute/qdrant')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { action, ...params } = body

        const logs: string[] = []
        logs.push(`Qdrant 操作: ${action}`)

        try {
          // === health: 检查 Qdrant 状态 ===
          if (action === 'health') {
            const { ok, data } = await qdrantFetch('/')
            logs.push(ok ? 'Qdrant 连接正常' : 'Qdrant 连接失败')
            return Response.json({
              status: ok ? 'success' : 'error',
              output: data,
              logs,
              error: ok ? undefined : 'Qdrant 服务不可用',
            })
          }

          // === collections: 获取集合列表 ===
          if (action === 'collections') {
            const { ok, data } = await qdrantFetch('/collections')
            const collections = data.result?.collections || []
            logs.push(`获取 ${collections.length} 个集合`)
            return Response.json({
              status: ok ? 'success' : 'error',
              output: { collections },
              logs,
              error: ok ? undefined : '获取集合列表失败',
            })
          }

          // === collection-info: 获取集合详情 ===
          if (action === 'collection-info') {
            const { collectionName } = params
            if (!collectionName) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, '缺少 collectionName'],
                error: '请提供集合名称',
              })
            }
            const { ok, data } = await qdrantFetch(`/collections/${encodeURIComponent(collectionName)}`)
            logs.push(ok ? `获取集合详情: ${collectionName}` : `集合 ${collectionName} 不存在`)
            return Response.json({
              status: ok ? 'success' : 'error',
              output: data.result || {},
              logs,
              error: ok ? undefined : `集合 ${collectionName} 不存在`,
            })
          }

          // === create-collection: 创建集合 ===
          if (action === 'create-collection') {
            const { collectionName, vectorSize = 1536, distance = 'Cosine' } = params
            if (!collectionName) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, '缺少 collectionName'],
                error: '请提供集合名称',
              })
            }

            const size = typeof vectorSize === 'string' ? parseInt(vectorSize, 10) : vectorSize
            if (!size || size < 64 || size > 16384) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, `无效的向量维度: ${vectorSize}`],
                error: '向量维度必须在 64 - 16384 之间',
              })
            }

            const { ok, data } = await qdrantFetch(
              `/collections/${encodeURIComponent(collectionName)}`,
              {
                method: 'PUT',
                body: JSON.stringify({
                  vectors: {
                    size,
                    distance,
                  },
                }),
              },
            )
            logs.push(ok ? `创建集合成功: ${collectionName}` : `创建集合失败`)
            return Response.json({
              status: ok ? 'success' : 'error',
              output: data,
              logs,
              error: ok ? undefined : data.status?.error || '创建集合失败',
            })
          }

          // === delete-collection: 删除集合 ===
          if (action === 'delete-collection') {
            const { collectionName } = params
            if (!collectionName) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, '缺少 collectionName'],
                error: '请提供集合名称',
              })
            }
            const { ok, data } = await qdrantFetch(
              `/collections/${encodeURIComponent(collectionName)}`,
              { method: 'DELETE' },
            )
            logs.push(ok ? `删除集合成功: ${collectionName}` : '删除集合失败')
            return Response.json({
              status: ok ? 'success' : 'error',
              output: data,
              logs,
              error: ok ? undefined : data.status?.error || '删除集合失败',
            })
          }

          // === upsert: 写入向量点 ===
          if (action === 'upsert') {
            const { collectionName, points } = params
            if (!collectionName || !points || !Array.isArray(points)) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, '缺少 collectionName 或 points'],
                error: '请提供集合名称和待写入的点数据',
              })
            }

            const { ok, data } = await qdrantFetch(
              `/collections/${encodeURIComponent(collectionName)}/points?wait=true`,
              {
                method: 'PUT',
                body: JSON.stringify({ points }),
              },
            )
            const isSuccess = ok && data.status === 'ok'
            logs.push(isSuccess ? `写入 ${points.length} 个向量点` : `写入向量点失败: ${data.status?.error || data.error || 'unknown'}`)
            return Response.json({
              status: isSuccess ? 'success' : 'error',
              output: { count: points.length, result: data },
              logs,
              error: isSuccess ? undefined : data.status?.error || data.error || '写入向量点失败',
            })
          }

          // === search: 向量搜索 ===
          if (action === 'search') {
            const { collectionName, vector, filter, topK = 5, scoreThreshold = 0 } = params
            if (!collectionName || !vector) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, '缺少 collectionName 或 vector'],
                error: '请提供集合名称和搜索向量',
              })
            }

            const searchBody: Record<string, any> = {
              vector,
              limit: topK,
              with_payload: true,
              with_vector: false,
            }
            if (scoreThreshold > 0) {
              searchBody.score_threshold = scoreThreshold
            }
            if (filter) {
              searchBody.filter = filter
            }

            const { ok, data } = await qdrantFetch(
              `/collections/${encodeURIComponent(collectionName)}/points/search`,
              {
                method: 'POST',
                body: JSON.stringify(searchBody),
              },
            )

            const results = data.result || []
            logs.push(`搜索到 ${results.length} 条结果`)

            return Response.json({
              status: ok ? 'success' : 'error',
              output: { results, count: results.length },
              logs,
              error: ok ? undefined : data.status?.error || '搜索失败',
            })
          }

          // === get-points: 获取集合中的点 ===
          if (action === 'get-points') {
            const { collectionName, limit = 20, offset = 0, withVector = false } = params
            if (!collectionName) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, '缺少 collectionName'],
                error: '请提供集合名称',
              })
            }

            const { ok, data } = await qdrantFetch(
              `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
              {
                method: 'POST',
                body: JSON.stringify({
                  limit,
                  offset: offset || undefined,
                  with_payload: true,
                  with_vector: withVector,
                }),
              },
            )

            const points = data.result?.points || []
            const nextOffset = data.result?.next_page_offset
            logs.push(`获取 ${points.length} 个点`)

            return Response.json({
              status: ok ? 'success' : 'error',
              output: { points, count: points.length, nextOffset },
              logs,
              error: ok ? undefined : data.status?.error || '获取点数据失败',
            })
          }

          // === scroll: 读取集合全量向量（用于可视化） ===
          if (action === 'scroll') {
            const { collectionName, maxPoints = 500 } = params
            if (!collectionName) {
              return Response.json({
                status: 'error',
                output: {},
                logs: [...logs, '缺少 collectionName'],
                error: '请提供集合名称',
              })
            }

            // 先获取集合信息
            const { data: infoData } = await qdrantFetch(`/collections/${encodeURIComponent(collectionName)}`)

            // 拉取集合中的点（按 vector 大小限制批次）
            const allPoints: any[] = []
            let offset: string | number | undefined = undefined
            const batchSize = 100

            while (true) {
              const { ok, data } = await qdrantFetch(
                `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    limit: batchSize,
                    offset,
                    with_payload: true,
                    with_vector: true,
                  }),
                },
              )

              if (!ok) break

              const points = data.result?.points || []
              if (points.length === 0) break

              allPoints.push(...points)
              if (allPoints.length >= maxPoints || !data.result?.next_page_offset) break

              offset = data.result.next_page_offset
            }

            logs.push(`读取集合 ${collectionName} 的 ${allPoints.length} 个向量点`)
            return Response.json({
              status: 'success',
              output: {
                points: allPoints.slice(0, maxPoints),
                count: allPoints.slice(0, maxPoints).length,
                collectionInfo: infoData.result || {},
              },
              logs,
            })
          }

          // === 未知操作 ===
          return Response.json({
            status: 'error',
            output: {},
            logs: [...logs, `未知操作: ${action}`],
            error: `未知操作类型: ${action}`,
          })
        } catch (err: any) {
          logs.push(`操作失败: ${err.message}`)
          return Response.json({
            status: 'error',
            output: {},
            logs,
            error: `Qdrant 操作失败: ${err.message}`,
          })
        }
      },
    },
  },
})
