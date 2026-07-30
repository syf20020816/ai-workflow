import { createFileRoute } from '@tanstack/react-router'
import { execSync } from 'node:child_process'

/**
 * 对 shell 双引号内的内容进行转义
 */
function escapeShellArg(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
}

/**
 * 将 wiki URL 解析为数字型 space_id
 *
 * 优先级:
 *  1. URL 路径段是纯数字 → 直接作为 space_id 使用
 *  2. +space-list 获取用户知识库列表，取第一个 space_id
 *  3. +node-get (仅文档级 URL /wiki/wikcnXXX)
 */
function resolveSpaceId(input: string): { spaceId: string; nodeToken: string } {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('链接不能为空')

  // 提取 URL 中 /wiki/ 后的路径段
  let pathSegment = trimmed
  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    const wikiIdx = parts.findIndex((p) => p === 'wiki')
    if (wikiIdx !== -1 && wikiIdx + 1 < parts.length) {
      // /wiki/space/<spaceId> 或 /wiki/<nodeToken>
      const afterWiki = parts[wikiIdx + 1]
      pathSegment = afterWiki === 'space' && wikiIdx + 2 < parts.length
        ? parts[wikiIdx + 2]
        : afterWiki
    }
  } catch {
    pathSegment = trimmed
  }

  // 尝试 1: 路径段是纯数字 → 直接作为 space_id 使用
  if (/^\d+$/.test(pathSegment)) {
    return { spaceId: pathSegment, nodeToken: '' }
  }

  // 尝试 2: +space-list 获取所有可访问知识库，取第一个
  const listCmd = `lark-cli wiki +space-list --as user --format json`
  const listStdout = execSync(listCmd, { encoding: 'utf-8', timeout: 30000 })
  const listResult = JSON.parse(listStdout)
  if (listResult.ok) {
    const spaces = listResult.data?.items || []
    if (spaces.length > 0) {
      const spaceId = spaces[0].space_id || spaces[0].id || ''
      if (spaceId) {
        return { spaceId, nodeToken: '' }
      }
    }
  }

  // 尝试 3: +node-get (处理文档级 URL，如 /wiki/wikcnXXX)
  try {
    const cmd = `lark-cli wiki +node-get --node-token "${escapeShellArg(trimmed)}" --format json 2>/dev/null`
    const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 15000 })
    const result = JSON.parse(stdout)
    if (result.ok && result.data?.space_id) {
      return { spaceId: result.data.space_id, nodeToken: result.data.node_token || '' }
    }
  } catch {
    // +node-get 失败，继续
  }

  throw new Error('无法解析知识库链接，请确认链接正确')
}

/**
 * 调用 lark-cli wiki +node-list 获取指定节点的子节点列表
 */
function listNodes(spaceId: string, parentNodeToken?: string): any[] {
  let cmd = `lark-cli wiki +node-list --space-id "${escapeShellArg(spaceId)}" --as user --page-all --format json`
  if (parentNodeToken) {
    cmd += ` --parent-node-token "${escapeShellArg(parentNodeToken)}"`
  }
  const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 60000 })
  const result = JSON.parse(stdout)
  if (result.ok === false) {
    throw new Error(result.error?.message || '获取节点列表失败')
  }
  return result.data?.nodes || []
}

/**
 * 递归遍历知识库节点树，收集所有文档类型节点
 */
function walkTree(
  spaceId: string,
  parentNodeToken?: string,
  parentPath: string = '',
): Array<{ nodeToken: string; objToken: string; title: string; path: string }> {
  const docs: Array<{ nodeToken: string; objToken: string; title: string; path: string }> = []
  const nodes = listNodes(spaceId, parentNodeToken)

  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} / ${node.title || ''}` : (node.title || '')

    // 文档类型节点（doc/docx 等），记录以便后续读取内容
    if (node.obj_type && (node.obj_type.startsWith('doc') || node.obj_type === 'bitable' || node.obj_type === 'sheet' || node.obj_type === 'slides' || node.obj_type === 'mindnote')) {
      docs.push({
        nodeToken: node.node_token || '',
        objToken: node.obj_token || '',
        title: node.title || '',
        path: currentPath,
      })
    }

    // 有子节点则递归遍历
    if (node.has_child) {
      docs.push(...walkTree(spaceId, node.node_token, currentPath))
    }
  }

  return docs
}

/**
 * 读取知识库文档内容（通过 docs +fetch）
 */
function readDocContent(objToken: string): string {
  // 优先用 markdown 格式获取内容
  const cmd = `lark-cli docs +fetch --doc "${escapeShellArg(objToken)}" --doc-format markdown --format json`
  const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 30000 })
  const result = JSON.parse(stdout)

  if (result.ok === false) {
    throw new Error(result.error?.message || '读取文档失败')
  }

  const document = result.data?.document || result.data || {}
  let content = document.content || document.text || ''
  if (!content && typeof document === 'string') {
    content = document
  }
  return content
}

/**
 * Lark 知识库遍历 API
 * 仅遍历知识库并读取文档内容，不做分块/向量化。
 * 下游知识库写入节点负责向量化存储。
 */
export const Route = createFileRoute('/api/execute/larkWikiTraversal')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { spaceUrl, spaceId: rawSpaceId, maxDocs } = body

        const logs: string[] = []
        let spaceId = rawSpaceId || ''

        try {
          // 如果有 spaceUrl，通过 +node-get 解析为数字型 space_id
          if (spaceUrl) {
            logs.push(`正在解析知识库链接...`)
            const resolved = resolveSpaceId(spaceUrl)
            spaceId = resolved.spaceId
            logs.push(`解析成功: space_id=${spaceId}, node_token=${resolved.nodeToken}`)
          }

          if (!spaceId) {
            return Response.json({
              status: 'error',
              output: { totalDocs: 0, documents: [] },
              logs: [...logs, '缺少 spaceId'],
              error: '请填写 Lark 知识库链接',
            })
          }

          const max = maxDocs || 200
          logs.push(`开始遍历知识库空间: ${spaceId}`)
          logs.push(`最大文档数: ${max}`)

          // Step 1: 递归遍历知识库节点树，收集文档
          logs.push('正在遍历知识库节点树（逐层递归）...')
          const allDocs = walkTree(spaceId)
          const docs = allDocs.slice(0, max)

          logs.push(`知识库中共 ${allDocs.length} 个文档节点，本次处理前 ${docs.length} 个`)

          if (docs.length === 0) {
            return Response.json({
              status: 'success',
              output: { totalDocs: 0, documents: [] },
              logs: [...logs, '未找到文档节点'],
            })
          }

          // Step 2: 逐个读取文档内容
          const documents: Array<{ title: string; content: string; path: string }> = []

          for (let i = 0; i < docs.length; i++) {
            const doc = docs[i]
            logs.push(`[${i + 1}/${docs.length}] 读取文档: ${doc.title}`)

            try {
              const content = readDocContent(doc.objToken)

              if (!content) {
                logs.push(`  ⚠️ 文档内容为空，跳过`)
                continue
              }

              logs.push(`  内容长度: ${content.length} 字符`)
              documents.push({
                title: doc.title,
                content,
                path: doc.path,
              })
            } catch (docErr: any) {
              logs.push(`  ⚠️ 读取文档 "${doc.title}" 失败: ${docErr.message}，跳过`)
            }
          }

          logs.push(`\n全部完成: 共遍历 ${allDocs.length} 个文档, 成功读取 ${documents.length} 个`)

          return Response.json({
            status: 'success',
            output: {
              totalDocs: documents.length,
              documents,
            },
            logs,
          })
        } catch (err: any) {
          logs.push(`命令失败: ${err.message}`)
          return Response.json({
            status: 'error',
            output: { totalDocs: 0, documents: [] },
            logs,
            error: `Lark Wiki Traversal 失败: ${err.message}`,
          })
        }
      },
    },
  },
})
