/**
 * 导出输入物收集器（后端专用）
 *
 * 负责在导出 zip 时拉取各节点引用的真实内容：
 * - Skill 文件
 * - Memory 文件
 * - Lark 文档 / 知识库
 * - Qdrant 集合纯文本快照
 *
 * 本文件使用 Node.js fs/path 与外部 API，只能被后端 route/service 导入。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import type { Node } from '@xyflow/react'
import { listCollectableArtifacts } from '#/services/exporter'

const SKILLS_DIR = path.resolve(process.cwd(), 'workflows/skills')
const MEMORY_DIR = path.resolve(process.cwd(), 'memory')
const MEMORY_FILE = path.join(MEMORY_DIR, 'memory.md')
const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333'

export interface CollectedArtifact {
  path: string
  content: string
  source: string
  warning?: string
}

export interface CollectOptions {
  knowledgeStrategy?: 'snapshot' | 'api'
  snapshotThreshold?: number
}

/** 读取文件，不存在返回 null */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

/** 收集所有 Skill 文件内容 */
async function collectSkills(ids: string[]): Promise<CollectedArtifact[]> {
  const results: CollectedArtifact[] = []
  for (const id of ids) {
    const skillMdPath = path.join(SKILLS_DIR, id, 'SKILL.md')
    const content = await readFileSafe(skillMdPath)
    if (content !== null) {
      results.push({ path: `skills/${id}/SKILL.md`, content, source: `skill:${id}` })
    } else {
      results.push({
        path: `skills/${id}/SKILL.md`,
        content: `<!-- SKILL ${id} 文件未找到 -->\n`,
        source: `skill:${id}`,
        warning: `未找到 ${skillMdPath}`,
      })
    }
  }
  return results
}

/** 收集 memory 文件 */
async function collectMemories(paths: string[]): Promise<CollectedArtifact[]> {
  const results: CollectedArtifact[] = []
  for (const p of paths) {
    const normalized = p.replace(/^\/+/, '')
    const content = normalized === 'memory/memory.md'
      ? await readFileSafe(MEMORY_FILE)
      : await readFileSafe(path.resolve(process.cwd(), normalized))
    if (content !== null) {
      results.push({ path: normalized, content, source: `memory:${p}` })
    } else {
      results.push({
        path: normalized,
        content: `<!-- memory 文件未找到: ${p} -->\n`,
        source: `memory:${p}`,
        warning: `未找到 ${p}`,
      })
    }
  }
  return results
}

/** 调用 lark-cli 读取文档 */
function fetchLarkDoc(url: string): { content: string; warning?: string } {
  try {
    const stdout = execSync(
      `lark-cli docs +fetch --doc "${url}" --doc-format markdown --format json`,
      { encoding: 'utf-8', timeout: 30000 },
    )
    const result = JSON.parse(stdout)
    if (result.ok === false) {
      return {
        content: `<!-- Lark 文档读取失败: ${url} -->\n`,
        warning: result.error?.message || 'Lark 操作失败',
      }
    }
    // lark-cli +fetch 返回的 JSON 中 content 字段可能包含 markdown
    const content = result.data?.content || result.content || stdout
    return { content: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }
  } catch (err: any) {
    return {
      content: `<!-- Lark 文档读取失败: ${url} -->\n`,
      warning: err.message,
    }
  }
}

/** 收集 Lark 文档 */
function collectLarkDocs(urls: string[]): CollectedArtifact[] {
  return urls.map((url) => {
    const { content, warning } = fetchLarkDoc(url)
    const fileName = url.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'lark-doc'
    return {
      path: `inputs/lark/${fileName}.md`,
      content,
      source: `lark:${url}`,
      warning,
    }
  })
}

/** 对 shell 双引号内的内容进行转义 */
function escapeShellArg(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
}

/** 将 wiki URL 解析为数字型 space_id（复制自 larkWikiTraversal.ts） */
function resolveSpaceId(input: string): { spaceId: string; nodeToken: string } {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('链接不能为空')

  let pathSegment = trimmed
  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    const wikiIdx = parts.findIndex((p) => p === 'wiki')
    if (wikiIdx !== -1 && wikiIdx + 1 < parts.length) {
      const afterWiki = parts[wikiIdx + 1]
      pathSegment = afterWiki === 'space' && wikiIdx + 2 < parts.length
        ? parts[wikiIdx + 2]
        : afterWiki
    }
  } catch {
    pathSegment = trimmed
  }

  if (/^\d+$/.test(pathSegment)) {
    return { spaceId: pathSegment, nodeToken: '' }
  }

  const listCmd = `lark-cli wiki +space-list --as user --format json`
  const listStdout = execSync(listCmd, { encoding: 'utf-8', timeout: 30000 })
  const listResult = JSON.parse(listStdout)
  if (listResult.ok) {
    const spaces = listResult.data?.items || []
    if (spaces.length > 0) {
      const spaceId = spaces[0].space_id || spaces[0].id || ''
      if (spaceId) return { spaceId, nodeToken: '' }
    }
  }

  try {
    const cmd = `lark-cli wiki +node-get --node-token "${escapeShellArg(trimmed)}" --format json 2>/dev/null`
    const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 15000 })
    const result = JSON.parse(stdout)
    if (result.ok && result.data?.space_id) {
      return { spaceId: result.data.space_id, nodeToken: result.data.node_token || '' }
    }
  } catch {
    // ignore
  }

  throw new Error('无法解析知识库链接，请确认链接正确')
}

/** 调用 lark-cli wiki +node-list 获取指定节点的子节点列表 */
function listWikiNodes(spaceId: string, parentNodeToken?: string): any[] {
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

/** 递归遍历知识库节点树 */
function walkWikiTree(
  spaceId: string,
  parentNodeToken?: string,
  parentPath: string = '',
): Array<{ nodeToken: string; objToken: string; title: string; path: string }> {
  const docs: Array<{ nodeToken: string; objToken: string; title: string; path: string }> = []
  const nodes = listWikiNodes(spaceId, parentNodeToken)

  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} / ${node.title || ''}` : (node.title || '')
    if (node.obj_type && (node.obj_type.startsWith('doc') || ['bitable', 'sheet', 'slides', 'mindnote'].includes(node.obj_type))) {
      docs.push({
        nodeToken: node.node_token || '',
        objToken: node.obj_token || '',
        title: node.title || '',
        path: currentPath,
      })
    }
    if (node.has_child) {
      docs.push(...walkWikiTree(spaceId, node.node_token, currentPath))
    }
  }

  return docs
}

/** 读取知识库文档内容 */
function readWikiDocContent(objToken: string): string {
  const cmd = `lark-cli docs +fetch --doc "${escapeShellArg(objToken)}" --doc-format markdown --format json`
  const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 30000 })
  const result = JSON.parse(stdout)
  if (result.ok === false) {
    throw new Error(result.error?.message || '读取文档失败')
  }
  const document = result.data?.document || result.data || {}
  let content = document.content || document.text || ''
  if (!content && typeof document === 'string') content = document
  return content
}

/** 收集 Lark Wiki 空间文档 */
function collectLarkWikiSpaces(spaceUrls: string[]): CollectedArtifact[] {
  const results: CollectedArtifact[] = []
  for (const url of spaceUrls) {
    try {
      const { spaceId } = resolveSpaceId(url)
      const docs = walkWikiTree(spaceId).slice(0, 200)
      const parts: string[] = [`# Lark 知识库: ${url}\n`]
      for (const doc of docs) {
        try {
          const content = readWikiDocContent(doc.objToken)
          parts.push(`## ${doc.title}\n\n路径: ${doc.path}\n\n${content}`)
        } catch (err: any) {
          parts.push(`## ${doc.title}\n\n<!-- 读取失败: ${err.message} -->`)
        }
      }
      const fileName = url.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'wiki'
      results.push({
        path: `inputs/lark/wiki/${fileName}.md`,
        content: parts.join('\n\n---\n\n'),
        source: `lark-wiki:${url}`,
      })
    } catch (err: any) {
      const fileName = url.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'wiki'
      results.push({
        path: `inputs/lark/wiki/${fileName}.md`,
        content: `<!-- Lark 知识库遍历失败: ${url} -->\n`,
        source: `lark-wiki:${url}`,
        warning: err.message,
      })
    }
  }
  return results
}

/** 直接调用 Qdrant scroll API 拉取集合全部 payload.content */
async function fetchQdrantCollectionContent(collectionName: string): Promise<string> {
  const allContents: string[] = []
  let offset: string | number | undefined
  const batchSize = 100

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const res = await fetch(`${QDRANT_HOST}/collections/${encodeURIComponent(collectionName)}/points/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: batchSize, offset, with_payload: true, with_vector: false }),
    })
    if (!res.ok) {
      throw new Error(`Qdrant scroll failed: ${res.status}`)
    }
    const data = await res.json()
    const points = data.result?.points || []
    if (points.length === 0) break

    for (const point of points) {
      const text = point.payload?.content || point.payload?.text || ''
      if (text) allContents.push(text)
    }

    if (!data.result?.next_page_offset) break
    offset = data.result.next_page_offset
  }

  return allContents.join('\n\n---\n\n')
}

/** 收集 Qdrant 集合纯文本快照 */
async function collectKnowledgeSnapshots(
  collections: string[],
  threshold: number,
): Promise<CollectedArtifact[]> {
  const results: CollectedArtifact[] = []
  for (const name of collections) {
    try {
      const content = await fetchQdrantCollectionContent(name)
      const size = Buffer.byteLength(content, 'utf-8')
      const warning = size > threshold
        ? `集合 ${name} 快照大小 ${(size / 1024 / 1024).toFixed(2)}MB，超过阈值 ${(threshold / 1024 / 1024).toFixed(0)}MB`
        : undefined
      results.push({
        path: `knowledge/${name.replace(/[^a-zA-Z0-9_-]+/g, '-')}.md`,
        content,
        source: `qdrant:${name}`,
        warning,
      })
    } catch (err: any) {
      results.push({
        path: `knowledge/${name.replace(/[^a-zA-Z0-9_-]+/g, '-')}.md`,
        content: `<!-- Qdrant 集合 ${name} 读取失败 -->\n`,
        source: `qdrant:${name}`,
        warning: err.message,
      })
    }
  }
  return results
}

/** 收集所有需要真实内容的输入物 */
export async function collectArtifacts(nodes: Node[], options: CollectOptions = {}): Promise<CollectedArtifact[]> {
  const {
    skills,
    memories,
    larkUrls,
    larkWikiSpaces,
    knowledgeCollections,
  } = listCollectableArtifacts(nodes)

  const results: CollectedArtifact[] = []
  results.push(...await collectSkills(skills))
  results.push(...await collectMemories(memories))
  results.push(...collectLarkDocs(larkUrls))
  results.push(...collectLarkWikiSpaces(larkWikiSpaces))

  if (options.knowledgeStrategy !== 'api') {
    const threshold = options.snapshotThreshold ?? 2 * 1024 * 1024
    results.push(...await collectKnowledgeSnapshots(knowledgeCollections, threshold))
  }

  return results
}
