/**
 * 导出输入物收集器（后端专用）
 *
 * 负责在导出 zip 时收集各节点引用的真实内容：
 * - userInput / agent 静态输入（文字/提示词/URL 清单）
 * - Skill 文件（workflows/skills/<id>/SKILL.md）
 * - BMad 角色文件（内容内联在节点 data，生成文件）
 * - Memory 文件
 * - Lark 文档：不拉取全文，导出 URL 清单 + lark-cli 使用技能
 * - Lark Wiki 知识库全量快照
 * - Qdrant 集合纯文本快照
 *
 * 本文件使用 Node.js fs/path 与外部 API，只能被后端 route/service 导入。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import type { Node } from '@xyflow/react'
import {
  listCollectableArtifacts,
  userInputArtifactPath,
  skillArtifactPath,
  bmadArtifactPath,
  wikiArtifactPath,
  knowledgeArtifactPath,
  memoryArtifactPath,
  safeSegment,
} from '#/services/exporter'

// re-export：zip 导出 API 经动态 import 从本模块取用
export { openSpecSchemaDir, specChangeDir } from '#/services/exporter'

const SKILLS_DIR = path.resolve(process.cwd(), 'workflows/skills')
const MEMORY_FILE = path.resolve(process.cwd(), 'memory/memory.md')
const QDRANT_HOST = process.env.QDRANT_HOST || 'http://localhost:6333'

export interface CollectedArtifact {
  /** zip 包内相对路径 */
  path: string
  /** 文件内容 */
  content: string
  /** 来源标识（skill:<id> / memory:<path> / lark:<url> ...） */
  source: string
  /** 收集过程中的警告（不影响导出，写入 manifest 日志） */
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

// ==================== userInput / agent 静态输入 ====================

/** 收集 userInput / agent 节点的静态输入内容（label/prompt/files/urls） */
async function collectUserInputs(
  nodes: Node[],
  larkUrls: Array<{ url: string; kind: 'doc' | 'template'; title: string }>,
): Promise<CollectedArtifact[]> {
  const results: CollectedArtifact[] = []
  const userUrls: string[] = []

  for (const node of nodes) {
    const data = node.data as Record<string, any>
    const input = data.input || {}
    const mdPath = userInputArtifactPath(node)
    const filesDir = path.dirname(mdPath) + '/files'
    const parts: string[] = [`# ${data.title || '用户输入'}`]

    if (input.label) parts.push(`## 输入内容\n\n${input.label}`)
    if (input.prompt) parts.push(`## 提示词\n\n${input.prompt}`)

    // 上传文件：File 对象经 JSON 序列化后无法读取内容，仅能检测存在性
    const files: unknown[] = Array.isArray(input.files) ? input.files : []
    files.forEach((file, i) => {
      if (
        file && typeof file === 'object' &&
        typeof (file as File).text === 'function'
      ) {
        // 仅前端直调（非 JSON 请求）时可读到内容，后端通常走不到
        results.push({
          path: `${filesDir}/${safeSegment((file as File).name, `file-${i + 1}`)}`,
          content: `<!-- 文件内容见运行时上传，此处为占位 -->\n`,
          source: `user-input-file:${node.id}`,
        })
      } else {
        results.push({
          path: `${filesDir}/file-${i + 1}.md`,
          content: `<!-- 文件内容未持久化，无法随导出携带 -->\n`,
          source: `user-input-file:${node.id}`,
          warning: `节点 "${data.title || node.id}" 的第 ${i + 1} 个上传文件内容未持久化，导出为占位`,
        })
      }
    })

    if (Array.isArray(input.urls)) {
      for (const url of input.urls) {
        if (typeof url === 'string' && url) userUrls.push(url)
      }
    }

    results.push({
      path: mdPath,
      content: parts.join('\n\n') + '\n',
      source: `user-input:${node.id}`,
    })
  }

  // URL 清单（Lark 引用 + 用户输入链接），有内容才生成
  if (larkUrls.length > 0 || userUrls.length > 0) {
    const lines: string[] = ['# 输入 URL 清单', '']
    if (larkUrls.length > 0) {
      lines.push('## Lark 文档（lark-cli 读取，见 skills/lark-cli/SKILL.md）', '')
      for (const ref of larkUrls) {
        lines.push(`- [${ref.title}](${ref.url})${ref.kind === 'template' ? '（模板）' : ''}`)
      }
      lines.push('')
    }
    if (userUrls.length > 0) {
      lines.push('## 用户输入链接', '')
      for (const url of userUrls) lines.push(`- ${url}`)
      lines.push('')
    }
    results.push({
      path: 'inputs/urls.md',
      content: lines.join('\n'),
      source: 'urls',
    })
  }

  return results
}

// ==================== Skill ====================

/** 收集所有 Skill 文件内容（磁盘统一为 SKILL.md，大小写敏感系统同样命中） */
async function collectSkills(ids: string[]): Promise<CollectedArtifact[]> {
  const results: CollectedArtifact[] = []
  for (const id of ids) {
    const zipPath = skillArtifactPath(id)
    if (zipPath.includes('..')) {
      results.push({ path: zipPath, content: `<!-- 非法 skillId: ${id} -->\n`, source: `skill:${id}`, warning: `skillId 含非法路径段: ${id}` })
      continue
    }
    const diskPath = path.join(SKILLS_DIR, safeSegment(id, 'skill'), 'SKILL.md')
    const content = await readFileSafe(diskPath)
    if (content !== null) {
      results.push({ path: zipPath, content, source: `skill:${id}` })
    } else {
      results.push({
        path: zipPath,
        content: `<!-- SKILL ${id} 文件未找到 -->\n`,
        source: `skill:${id}`,
        warning: `未找到 ${diskPath}`,
      })
    }
  }
  return results
}

// ==================== BMad 角色 ====================

/** 从节点 data 生成 BMad 角色定义文件 */
function collectBMadAgents(nodes: Node[]): CollectedArtifact[] {
  const results: CollectedArtifact[] = []
  for (const node of nodes) {
    const data = node.data as Record<string, any>
    const role = data.role || 'bmad-agent'
    const parts: string[] = [
      `# ${role}`,
      '',
    ]
    if (data.agentId) parts.push(`Agent ID: ${data.agentId}`)
    if (data.roleDescription) parts.push(`## 角色职责\n\n${data.roleDescription}`)
    if (data.systemPrompt) parts.push(`## 系统提示词\n\n${data.systemPrompt}`)
    results.push({
      path: bmadArtifactPath(node),
      content: parts.join('\n\n') + '\n',
      source: `bmad:${node.id}`,
    })
  }
  return results
}

// ==================== Memory ====================

/** 收集 memory 文件 */
async function collectMemories(nodes: Node[]): Promise<CollectedArtifact[]> {
  const results: CollectedArtifact[] = []
  const seen = new Set<string>()
  for (const node of nodes) {
    const zipPath = memoryArtifactPath(node)
    if (seen.has(zipPath)) continue
    seen.add(zipPath)
    if (zipPath.includes('..')) {
      results.push({ path: 'memory/memory.md', content: `<!-- 非法 memoryPath，回退默认 -->\n`, source: `memory:${node.id}`, warning: `memoryPath 含非法路径段` })
      continue
    }
    const content = zipPath === 'memory/memory.md'
      ? await readFileSafe(MEMORY_FILE)
      : await readFileSafe(path.resolve(process.cwd(), zipPath))
    if (content !== null) {
      results.push({ path: zipPath, content, source: `memory:${node.id}` })
    } else {
      results.push({
        path: zipPath,
        content: `<!-- memory 文件未找到: ${zipPath} -->\n`,
        source: `memory:${node.id}`,
        warning: `未找到 ${zipPath}`,
      })
    }
  }
  return results
}

// ==================== Lark：URL 引用模式（不拉取全文） ====================

/** lark-cli 使用技能（静态内容，本地 agent 按指引自行读取文档） */
const LARK_CLI_SKILL = `---
name: lark-cli
description: 使用 lark-cli 读取本工作流引用的飞书文档
---

# 使用 lark-cli 读取飞书文档

本工作流引用的飞书文档 URL 清单见 \`inputs/urls.md\`。

读取文档内容（markdown）：

\`\`\`bash
lark-cli docs +fetch --doc "<文档URL>" --doc-format markdown --jq '.data.document.content'
\`\`\`

完整用法与安全约束参考：\`lark-cli skills read lark-doc\`。
`

/** Lark 文档引用模式：导出 URL 清单（在 collectUserInputs 中合并生成）+ lark-cli 技能文件 */
function collectLarkRefs(
  refs: Array<{ url: string; kind: 'doc' | 'template'; title: string }>,
): CollectedArtifact[] {
  if (refs.length === 0) return []
  return [
    { path: 'skills/lark-cli/SKILL.md', content: LARK_CLI_SKILL, source: 'lark-cli-skill' },
  ]
}

// ==================== Lark Wiki ====================

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

/** 收集 Lark Wiki 空间文档全量快照 */
function collectLarkWikiSpaces(nodes: Node[]): CollectedArtifact[] {
  const results: CollectedArtifact[] = []
  const seenPaths = new Set<string>()
  for (const node of nodes) {
    const data = node.data as Record<string, any>
    const zipPath = wikiArtifactPath(node)
    if (seenPaths.has(zipPath)) continue
    seenPaths.add(zipPath)
    try {
      const { spaceId } = resolveSpaceId(data.spaceUrl)
      const maxDocs = data.maxDocs || 200
      const docs = walkWikiTree(spaceId).slice(0, maxDocs)
      const parts: string[] = [`# Lark 知识库: ${data.spaceUrl}\n`]
      for (const doc of docs) {
        try {
          const content = readWikiDocContent(doc.objToken)
          parts.push(`## ${doc.title}\n\n路径: ${doc.path}\n\n${content}`)
        } catch (err: any) {
          parts.push(`## ${doc.title}\n\n<!-- 读取失败: ${err.message} -->`)
        }
      }
      results.push({
        path: zipPath,
        content: parts.join('\n\n---\n\n'),
        source: `lark-wiki:${data.spaceUrl}`,
      })
    } catch (err: any) {
      results.push({
        path: zipPath,
        content: `<!-- Lark 知识库遍历失败: ${data.spaceUrl} -->\n`,
        source: `lark-wiki:${data.spaceUrl}`,
        warning: err.message,
      })
    }
  }
  return results
}

// ==================== Qdrant ====================

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
    const zipPath = knowledgeArtifactPath(name)
    try {
      const content = await fetchQdrantCollectionContent(name)
      const size = Buffer.byteLength(content, 'utf-8')
      const warning = size > threshold
        ? `集合 ${name} 快照大小 ${(size / 1024 / 1024).toFixed(2)}MB，超过阈值 ${(threshold / 1024 / 1024).toFixed(0)}MB`
        : undefined
      results.push({ path: zipPath, content, source: `qdrant:${name}`, warning })
    } catch (err: any) {
      results.push({
        path: zipPath,
        content: `<!-- Qdrant 集合 ${name} 读取失败 -->\n`,
        source: `qdrant:${name}`,
        warning: err.message,
      })
    }
  }
  return results
}

// ==================== 汇总入口 ====================

/** 收集所有需要真实内容的输入物 */
export async function collectArtifacts(nodes: Node[], options: CollectOptions = {}): Promise<CollectedArtifact[]> {
  const plan = listCollectableArtifacts(nodes)

  const results: CollectedArtifact[] = []
  results.push(...await collectUserInputs(plan.userInputNodes, plan.larkRefs))
  results.push(...collectBMadAgents(plan.bmadNodes))
  results.push(...collectLarkRefs(plan.larkRefs))
  results.push(...await collectSkills(plan.skills))
  results.push(...await collectMemories(plan.memoryNodes))
  results.push(...collectLarkWikiSpaces(plan.wikiNodes))

  if (options.knowledgeStrategy !== 'api') {
    const threshold = options.snapshotThreshold ?? 2 * 1024 * 1024
    results.push(...await collectKnowledgeSnapshots(plan.knowledgeCollections, threshold))
  }

  return results
}
