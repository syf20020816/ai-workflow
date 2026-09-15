import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { startAgentCli, pollAgentCliTask, fetchLocalToolSkillContent } from '#/services/runner'
import { buildBudgetedContext } from '#/services/upstreamContext'

/**
 * 知识库检索节点执行器（双模式，平台不内置数据库）
 *
 * local 模式：通过 Runner 调用用户本机配置了 MCP 的 CLI agent，
 *   以自然语言查询用户自己的知识库（向量库/文档库/关系库/本地 md 目录皆可）；
 *   可选挂载一个 SKILL 作为查询指令上下文。
 *
 * api 模式：由后端 httpProxy 代理请求用户配置的外部知识库接口，
 *   请求 URL / 方法 / 请求头 / 请求体由用户在编辑面板中配置，
 *   请求体支持 {{field}} 占位符引用上游节点输出。
 */

/** 解析查询文本：节点配置的 query 优先，否则取上游累积上下文 */
function resolveQueryText(
  data: Record<string, any>,
  input: Record<string, any>,
): string {
  if (typeof data.query === 'string' && data.query.trim()) return data.query.trim()
  const budgeted = buildBudgetedContext(input, 64000)
  return (
    budgeted.response ||
    input.content ||
    input.text ||
    input.instruction ||
    input.query ||
    input.prompt ||
    input.result ||
    ''
  )
}

/**
 * 加载 SKILL 内容作为查询指令上下文
 * 支持两种来源：
 *  - 本机技能：skillId 形如 `local:<tool>:<skillName>`，由 Runner 读取用户本机 SKILL.md
 *  - 平台技能：skillId 为平台技能 ID，从 workflows/skills/{id}/SKILL.md 读取
 */
async function loadSkill(skillId: string | undefined, logs: string[]): Promise<string> {
  if (!skillId) return ''

  // 本机技能（local:<tool>:<skillName>）
  if (skillId.startsWith('local:')) {
    const rest = skillId.slice('local:'.length)
    const sep = rest.indexOf(':')
    if (sep === -1) return ''
    const tool = rest.slice(0, sep)
    const name = rest.slice(sep + 1)
    try {
      const content = await fetchLocalToolSkillContent(tool, name)
      if (content) {
        logs.push(`本机技能内容已加载 (${content.length} 字符)`)
      }
      return content
    } catch {
      return ''
    }
  }

  // 平台技能
  try {
    const res = await fetch(`/api/skill/content?id=${skillId}`)
    const result = await res.json()
    if (result.content) {
      logs.push(`技能内容已加载 (${result.content.length} 字符)`)
    }
    return result.content || ''
  } catch {
    return ''
  }
}

/** {{field}} 占位符替换：从上游 input 中取值 */
function resolveTemplate(template: string, input: Record<string, any>): string {
  return (template || '').replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = input[key]
    if (v === undefined || v === null) return ''
    return typeof v === 'string' ? v : JSON.stringify(v)
  })
}

/** 从 API 响应 JSON 中提取文本内容（兼容常见结构） */
function extractContent(json: any, depth = 0): string {
  if (depth > 4) return ''
  if (typeof json === 'string') return json
  if (typeof json !== 'object' || json === null) return ''

  for (const key of ['content', 'text', 'answer', 'result', 'data', 'message', 'retrievalContent', 'output']) {
    if (json[key] !== undefined && json[key] !== null) {
      const v = json[key]
      if (typeof v === 'string') return v
      if (typeof v === 'object') {
        const nested = extractContent(v, depth + 1)
        if (nested) return nested
      }
    }
  }

  if (Array.isArray(json)) {
    return json
      .map((item) => {
        if (typeof item === 'string') return item
        const nested = extractContent(item, depth + 1)
        return nested || (typeof item === 'object' ? JSON.stringify(item) : '')
      })
      .filter(Boolean)
      .join('\n')
  }

  try {
    return JSON.stringify(json)
  } catch {
    return ''
  }
}

/** local 模式：本地 CLI agent 自然语言查询用户自己的知识库 */
async function runLocal(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { config, input } = ctx
  const data = config.data
  const logs: string[] = []
  logs.push(`知识库检索（本地模式）开始执行`)

  const query = resolveQueryText(data, input)
  if (!query) {
    return {
      nodeId: config.nodeId,
      status: 'success',
      output: { retrievalContent: '', count: 0, mode: 'local' },
      logs: [...logs, '未提供查询文本，上游也无上下文，跳过'],
    }
  }

  const tool = data.tool
  if (!tool) {
    return {
      nodeId: config.nodeId,
      status: 'error',
      output: { retrievalContent: '', count: 0, mode: 'local' },
      logs: [...logs, '本地模式需要选择本地工具（该工具需配置访问你知识库的 MCP）'],
      error: '本地模式需要选择本地工具',
    }
  }

  const skillContent = await loadSkill(data.skillId, logs)
  const skillSection = skillContent
    ? `\n\n请参考以下技能指令来完成查询：\n${skillContent.slice(0, 20000)}`
    : ''

  const prompt = [
    '你正在为用户查询他自己配置的知识库。请通过你环境里可用的 MCP 工具 / 数据源访问，',
    '根据用户的查询检索相关内容，并把检索到的原始内容返回给用户（保留出处与关键信息）。',
    '如果无法访问知识库，请明确说明失败原因。',
    '',
    `用户查询：\n${query}`,
    skillSection,
  ].join('\n')

  logs.push(`正在调用本地工具 ${tool} 查询知识库...`)
  try {
    const taskId = await startAgentCli({ tool, prompt, timeoutMs: 10 * 60_000 })
    const task = await pollAgentCliTask(taskId)
    if (task.status === 'error') {
      throw new Error(task.error || '本地工具执行失败')
    }
    const content = task.output?.response || ''
    logs.push(`本地工具返回 ${content.length} 字符`)

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        retrievalContent: content,
        count: content ? 1 : 0,
        mode: 'local',
        response: content,
      },
      logs,
    }
  } catch (err: any) {
    logs.push(`本地工具调用失败: ${err.message}`)
    return {
      nodeId: config.nodeId,
      status: 'error',
      output: { retrievalContent: '', count: 0, mode: 'local' },
      logs,
      error: `本地知识库查询失败: ${err.message}`,
    }
  }
}

/** api 模式：后端代理请求用户配置的外部知识库接口 */
async function runApi(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { config, input } = ctx
  const data = config.data
  const logs: string[] = []
  logs.push(`知识库检索（远程 API 模式）开始执行`)

  const url = data.url
  if (!url) {
    return {
      nodeId: config.nodeId,
      status: 'error',
      output: { retrievalContent: '', count: 0, mode: 'api' },
      logs: [...logs, '远程 API 模式需要配置请求 URL'],
      error: '远程 API 模式需要配置请求 URL',
    }
  }

  const method = data.method || 'GET'
  const headers = (data.headers || [])
    .filter((h: any) => h?.key)
    .map((h: any) => ({ key: h.key, value: resolveTemplate(h.value, input) }))
  const body = resolveTemplate(data.body || '', input)

  logs.push(`请求: ${method} ${url}`)
  try {
    const res = await fetch('/api/execute/httpProxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, headers, body }),
    })
    const result = await res.json()
    if (result.status !== 'success') {
      throw new Error(result.error || '代理请求失败')
    }

    const out = result.output || {}
    const { text = '', json = null } = out

    let content = ''
    if (json && typeof json === 'object') {
      content = extractContent(json)
    }
    if (!content) {
      content = text
    }

    logs.push(`检索内容共 ${content.length} 字符 (HTTP ${out.statusCode || '-'})`)

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        retrievalContent: content,
        count: content ? 1 : 0,
        mode: 'api',
        statusCode: out.statusCode,
        responseText: text,
        responseJson: json,
      },
      logs,
    }
  } catch (err: any) {
    logs.push(`远程 API 请求失败: ${err.message}`)
    return {
      nodeId: config.nodeId,
      status: 'error',
      output: { retrievalContent: '', count: 0, mode: 'api' },
      logs,
      error: `远程知识库请求失败: ${err.message}`,
    }
  }
}

export const knowledgeRetrievalExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const mode = ctx.config.data.mode || 'local'
    return mode === 'api' ? runApi(ctx) : runLocal(ctx)
  },
}
