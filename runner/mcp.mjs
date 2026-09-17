#!/usr/bin/env node
/**
 * Picop MCP Server（stdio，零依赖）
 *
 * 让用户在自己工具（Claude Code / Codex / Trae 等）中通过 MCP 直连 Picop 能力：
 *   - workflow_build：自然语言 → 工作流定义（复用 prompts/flowBuilder.md + Runner /agent-cli）
 *   - workflow_export：工作流定义 → workflow.yml / SKILL.md（复用 Runner /file-write 落盘到用户项目）
 *
 * 用户侧注册示例（Claude Code）：
 *   claude mcp add picop -- node <ai-workflow>/runner/mcp.mjs
 *
 * 依赖：本机已启动 Runner（node runner/server.mjs，默认 http://127.0.0.1:7523）
 * 环境变量：
 *   RUNNER_URL   Runner 地址，默认 http://127.0.0.1:7523
 *   PICOP_DIR    ai-workflow 项目目录（定位 prompts/），默认本文件上一级
 *
 * 启动：node runner/mcp.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const PROTOCOL_VERSION = '2024-11-05'
const RUNNER_URL = process.env.RUNNER_URL || 'http://127.0.0.1:7523'
const PICOP_DIR =
  process.env.PICOP_DIR ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_INFO = { name: 'picop-mcp', version: '0.1.0' }

// === Runner HTTP 客户端（无 Origin 请求，Runner 按本机脚本放行） ===

async function runnerJson(pathname, { method = 'GET', body } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(RUNNER_URL + pathname, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Runner HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// === 工具 1：workflow_build ===

/** 与 src/services/flowBuilder.ts parseWorkflowResponse 对齐 */
function parseWorkflowResponse(text) {
  const jsonMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : String(text || '').trim()
  const parsed = JSON.parse(jsonStr)
  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('AI 响应中缺少 nodes 数组')
  }
  if (!Array.isArray(parsed.edges)) parsed.edges = []
  if (!parsed.explanation) parsed.explanation = '工作流已生成'
  return {
    explanation: parsed.explanation,
    workflow: { nodes: parsed.nodes, edges: parsed.edges },
  }
}

async function buildWorkflow({ description, tool, timeoutMs }) {
  if (!description || !String(description).trim()) {
    throw new Error('缺少 description（用户需求描述）')
  }

  // 工具探测：未指定时自动选第一个本机已安装的 AI CLI
  let toolId = tool
  if (!toolId) {
    const probe = await runnerJson('/tools')
    const first = (probe?.output?.tools || []).find((t) => t.available)
    if (!first) {
      throw new Error('本机未安装任何 AI CLI 工具（claude-code / codex / deepseek），请先安装一个')
    }
    toolId = first.id
  }

  const flowBuilderPrompt = fs.readFileSync(
    path.join(PICOP_DIR, 'prompts/flowBuilder.md'),
    'utf-8',
  )
  const prompt = [
    flowBuilderPrompt,
    `[用户需求]\n${String(description).trim()}`,
    '--- 当前工作流状态 ---\n当前画布为空',
  ].join('\n\n')

  const timeout = Math.min(Number(timeoutMs) || 5 * 60_000, 30 * 60_000)
  const start = await runnerJson('/agent-cli', {
    method: 'POST',
    body: { tool: toolId, prompt, timeoutMs: timeout },
  })
  if (start.error) throw new Error(start.error)
  const taskId = start?.output?.taskId
  if (!taskId) throw new Error('Runner 未返回 taskId')

  // 轮询任务结果（3s 间隔，最长 = 任务超时 + 30s）
  const deadline = Date.now() + timeout + 30_000
  let task = null
  while (Date.now() < deadline) {
    await sleep(3000)
    const res = await runnerJson(`/task/${taskId}`)
    task = res?.output || null
    if (task && (task.status === 'done' || task.status === 'error')) break
  }
  if (!task || task.status === 'running') throw new Error('工作流生成超时')
  if (task.status === 'error') throw new Error(task.error || '工作流生成失败')

  return parseWorkflowResponse(task.output?.response || '')
}

// === 工具 2：workflow_export ===

/** 生成合法 step / 文件 id（与 exporter.ts toStepId 对齐） */
function toStepId(raw, fallback) {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return id || fallback
}

/** 平台节点类型全集（与 src/types/index.ts NodeTypes 对齐） */
const VALID_NODE_TYPES = new Set([
  'userInput',
  'agent',
  'aiOutput',
  'answer',
  'bmadAgent',
  'lark',
  'larkTemplate',
  'memory',
  'skill',
  'knowledgeRetrieval',
  'keywordAgent',
  'taskPlanner',
  'selfCheck',
  'codeAgent',
  'custom',
])

/** 节点类型 → Speckit 命令（与 specMap.ts NODE_TYPE_TO_SPECKIT 对齐，无 specStep 兜底） */
const NODE_TYPE_TO_SPECKIT = {
  agent: 'speckit.plan',
  taskPlanner: 'speckit.tasks',
  selfCheck: 'speckit.analyze',
  codeAgent: 'speckit.implement',
  keywordAgent: 'speckit.specify',
  bmadAgent: 'speckit.plan',
  skill: 'speckit.plan',
}

/** 节点类型 → OpenSpec artifact（与 specMap.ts NODE_TYPE_TO_OPENSPEC 对齐） */
const NODE_TYPE_TO_OPENSPEC = {
  agent: 'proposal',
  taskPlanner: 'tasks',
  selfCheck: 'review',
  keywordAgent: 'proposal',
}

/** 节点类型 → SKILL 指令兜底（与 exporter.ts skillNodeInstruction 默认分支对齐的常用子集） */
function fallbackInstruction(node) {
  switch (node.type) {
    case 'codeAgent':
      return '基于上游产物执行代码生成 / 修改。'
    case 'taskPlanner':
      return '基于上游产物拆解出可勾选的实施任务清单（- [ ] 子任务，含验收标准引用）。'
    case 'selfCheck':
      return '对已产出内容执行跨一致性检查，输出问题清单与修订建议。'
    case 'keywordAgent':
      return '从上下文提取关键词列表。'
    case 'aiOutput':
      return '将最终产物输出保存。'
    default:
      return ''
  }
}

function nodeTitle(node, i) {
  return node?.data?.title || node?.title || `${node.type} ${i + 1}`
}

function nodeInstruction(node) {
  const data = node?.data || {}
  return data.instruction || data.description || fallbackInstruction(node)
}

/** 工作流定义 → Speckit workflow.yml（对齐 exporter.ts buildSpecKitWorkflow 结构） */
function buildSpeckitYaml(nodes, edges, { name, slug }) {
  const lines = []
  lines.push(`schema_version: '1.0'`)
  lines.push('workflow:')
  lines.push(`  id: ${slug}`)
  lines.push(`  name: ${name}`)
  lines.push(`  version: '1.0.0'`)
  lines.push('  author: ai-workflow')
  lines.push(`  description: Exported from Picop (${nodes.length} nodes, ${edges.length} edges).`)
  lines.push('requires:')
  lines.push(`  speckit_version: '>=0.8.5'`)
  lines.push('  integrations:')
  lines.push('    any: [claude, copilot, gemini, opencode]')
  lines.push('inputs:')
  lines.push('  spec:')
  lines.push('    type: string')
  lines.push('    required: true')
  lines.push('    prompt: Describe what you want to build')
  lines.push('  integration:')
  lines.push('    type: string')
  lines.push('    default: auto')
  lines.push('steps:')
  nodes.forEach((n, i) => {
    const command = NODE_TYPE_TO_SPECKIT[n.type]
    if (!command) return // 输入/输出/控制节点不映射 command 步骤（与画布导出一致）
    const id = toStepId(nodeTitle(n, i), `step-${i + 1}`)
    lines.push(`  - id: ${id}`)
    lines.push(`    command: ${command}`)
    lines.push('    integration: {{ inputs.integration }}')
    const instruction = nodeInstruction(n)
    if (instruction) {
      lines.push('    input:')
      lines.push(`      args: ${JSON.stringify(instruction)}`)
    }
  })
  return lines.join('\n') + '\n'
}

/** artifacts 依赖图（OpenSpec / Spec 共用；与 exporter.ts buildArtifactsPipeline 结构对齐，
 *  MCP 生成的流程无 specStep 标注，故 OpenSpec 与 Spec 均采用类型兜底） */
function buildArtifacts(nodes) {
  const artifacts = []
  nodes.forEach((n, i) => {
    if (n.type === 'userInput') {
      const prompt = n.data?.input?.prompt || n.data?.instruction || '请提供本工作流的输入内容'
      artifacts.push({ id: `spec${artifacts.length > 0 ? artifacts.length + 1 : ''}`, role: 'spec', prompt })
    } else {
      const type = NODE_TYPE_TO_OPENSPEC[n.type]
      if (!type) return // 无类型兜底的节点不产出 artifact（与画布导出一致）
      let id = type
      const dup = artifacts.filter((a) => a.id === id || a.id.startsWith(`${id}-`)).length
      if (dup > 0) id = `${id}-${dup + 1}`
      artifacts.push({ id, type, instruction: nodeInstruction(n) || `执行「${nodeTitle(n, i)}」并产出 ${type} 产物` })
    }
  })
  artifacts.forEach((a, i) => {
    a.requires = i === 0 ? [] : [artifacts[i - 1].id]
  })
  return artifacts
}

/** 工作流定义 → OpenSpec schema.yaml（对齐 exporter.ts buildOpenSpecWorkflow：artifacts + apply 跟踪） */
function buildOpenSpecYaml(nodes, { name, slug }) {
  const artifacts = buildArtifacts(nodes)
  const lines = []
  lines.push(`name: ${slug}`)
  lines.push('version: 1')
  lines.push(`description: ${JSON.stringify(name)}`)
  lines.push('artifacts:')
  for (const a of artifacts) {
    lines.push(`  - id: ${a.id}`)
    if (a.role) lines.push(`    role: ${a.role}`)
    if (a.type) lines.push(`    type: ${a.type}`)
    lines.push(`    prompt: ${JSON.stringify(a.prompt || '')}`)
    if (a.instruction) lines.push(`    instruction: ${JSON.stringify(a.instruction)}`)
    lines.push(`    requires: [${a.requires.join(', ')}]`)
  }
  if (artifacts.length > 0) {
    const tracked = artifacts.find((a) => a.id === 'tasks') || artifacts[artifacts.length - 1]
    lines.push('apply:')
    lines.push(`  requires: [${tracked.id}]`)
    lines.push(`  tracks: ${tracked.id}.md`)
  }
  return lines.join('\n') + '\n'
}

/** 工作流定义 → Spec workflow.yaml（对齐 exporter.ts buildSpecWorkflow：同构 artifacts，无 apply） */
function buildSpecYaml(nodes, { name, slug }) {
  const artifacts = buildArtifacts(nodes)
  const lines = []
  lines.push(`name: ${slug}`)
  lines.push('version: 1')
  lines.push(`description: ${JSON.stringify(name)}`)
  lines.push('artifacts:')
  for (const a of artifacts) {
    lines.push(`  - id: ${a.id}`)
    if (a.role) lines.push(`    role: ${a.role}`)
    if (a.type) lines.push(`    type: ${a.type}`)
    lines.push(`    prompt: ${JSON.stringify(a.prompt || '')}`)
    if (a.instruction) lines.push(`    instruction: ${JSON.stringify(a.instruction)}`)
    lines.push(`    requires: [${a.requires.join(', ')}]`)
  }
  return lines.join('\n') + '\n'
}

/** 自动生成 SKILL frontmatter description（对齐 exporter.ts autoSkillDescription） */
function autoSkillDescription(name, nodes) {
  const titles = nodes.map((n) => nodeTitle(n, 0)).filter(Boolean)
  const summary = titles.slice(0, 8).join(' → ') + (titles.length > 8 ? ' …' : '')
  return `需要执行“${name}”工作流时使用。流程共 ${nodes.length} 个节点：${summary}。用 /${toStepId(name, 'picop-skill')} <prompt> 触发后按步骤依次执行。`
}

/** 工作流定义 → SKILL.md（对齐 exporter.ts buildSkillWorkflow 结构） */
function buildSkillMarkdown(nodes, { name, slug, description }) {
  const sections = nodes.map((n, i) => {
    const title = nodeTitle(n, i)
    let instruction
    if (n.type === 'userInput') {
      const param = i === 0 ? 'prompt' : `param${i + 1}`
      instruction =
        param === 'prompt'
          ? `用户输入 <prompt>：取调用 /${slug} <prompt> 时的 prompt 内容作为本节点输入。${
              n.data?.input?.prompt ? `\n附加提示词：${n.data.input.prompt}` : ''
            }`
          : `用户输入 ${param}：${n.data?.input?.prompt || '由调用方补充提供'}`
    } else {
      instruction = nodeInstruction(n)
    }
    return `### ${i + 1}. ${title}\n\n${instruction || '（该节点无额外指令，延续上游输出）'}`
  })

  const desc = description?.trim() || autoSkillDescription(name, nodes)
  return [
    '---',
    `name: ${name}`,
    'description: >-',
    `  ${desc.replace(/\n+/g, ' ')}`,
    '---',
    '',
    `# ${name}`,
    '',
    `用户以 \`/${slug} <prompt>\` 调用本技能，\`<prompt>\` 激活输入流程。严格按以下步骤顺序执行。`,
    '',
    '## 执行步骤',
    '',
    ...sections,
    '',
  ].join('\n')
}

/** 校验导出目标目录（防路径穿越，遵循项目硬约束） */
function safeResolve(targetDir) {
  const raw = String(targetDir || '')
  if (!raw.trim()) throw new Error('缺少 targetDir（导出目标目录）')
  if (raw.includes('..')) throw new Error('targetDir 不允许包含 ".."')
  return path.resolve(raw)
}

async function exportWorkflow({ workflow, format = 'speckit', name, targetDir, description }) {
  // workflow 允许是对象或 JSON 字符串
  let def = workflow
  if (typeof workflow === 'string') def = JSON.parse(workflow)
  if (!def || !Array.isArray(def.nodes)) {
    throw new Error('workflow 参数必须是 { nodes, edges } 结构')
  }
  const nodes = def.nodes
  const edges = Array.isArray(def.edges) ? def.edges : []
  if (!name || !String(name).trim()) throw new Error('缺少 name（工作流名称）')
  if (nodes.length === 0) throw new Error('工作流没有节点，无法导出')

  for (const n of nodes) {
    if (!VALID_NODE_TYPES.has(n.type)) throw new Error(`未知节点类型: ${n.type}`)
  }
  const fmt = String(format)
  if (!['speckit', 'openspec', 'spec', 'skill'].includes(fmt)) {
    throw new Error(`不支持的格式: ${format}（支持 speckit / openspec / spec / skill）`)
  }

  const wfName = String(name).trim()
  const slug = toStepId(wfName, 'picop-workflow')
  const artifacts = {
    speckit: [{ relativePath: `specify/workflows/${slug}/workflow.yml`, content: buildSpeckitYaml(nodes, edges, { name: wfName, slug }) }],
    openspec: [{ relativePath: `openspec/schemas/${slug}/schema.yaml`, content: buildOpenSpecYaml(nodes, { name: wfName, slug }) }],
    spec: [{ relativePath: `spec/changes/${slug}/specs/${slug}/workflow.yaml`, content: buildSpecYaml(nodes, { name: wfName, slug }) }],
    skill: [{ relativePath: `skills/${slug}/SKILL.md`, content: buildSkillMarkdown(nodes, { name: wfName, slug, description }) }],
  }[fmt]

  const baseDir = safeResolve(targetDir)
  const written = []
  for (const art of artifacts) {
    const full = path.join(baseDir, art.relativePath)
    if (!full.startsWith(baseDir + path.sep)) {
      throw new Error(`导出路径越界: ${art.relativePath}`)
    }
    const r = await runnerJson('/file-write', {
      method: 'POST',
      body: { filePath: full, content: art.content },
    })
    if (r.status !== 'success') throw new Error(r.error || `文件写入失败: ${art.relativePath}`)
    written.push(full)
  }
  return { format: fmt, files: written, nodes: nodes.length, edges: edges.length }
}

// === MCP stdio transport（newline-delimited JSON-RPC） ===

const TOOLS = [
  {
    name: 'workflow_build',
    description:
      '把用户自然语言描述的工作流程转换为 Picop 工作流定义（JSON）。调用后返回 explanation（AI 对流程的理解）与 workflow（nodes/edges 数组）。产物可通过 workflow_export 导出到用户项目。',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: '用户用自然语言描述的工作流程（如：每周一早上总结上周飞书会议纪要并生成周报）。',
        },
        tool: {
          type: 'string',
          enum: ['claude-code', 'codex', 'deepseek'],
          description: '执行生成的本地 AI CLI 工具 id；缺省自动探测第一个已安装的。',
        },
        timeoutMs: {
          type: 'number',
          description: '生成超时（毫秒），默认 5 分钟，上限 30 分钟。',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'workflow_export',
    description:
      '把 workflow_build 返回的工作流定义导出为可执行产物并写入用户项目目录。format 支持 4 种：speckit（specify/workflows/<name>/workflow.yml，SpecKit 命令步骤流水线）、openspec（openspec/schemas/<name>/schema.yaml，artifacts 依赖图 + apply 跟踪）、spec（spec/changes/<name>/specs/<name>/workflow.yaml，同构 artifacts 无 apply）、skill（skills/<name>/SKILL.md，独立任务指令技能）。',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'workflow_build 返回的 workflow 对象（含 nodes/edges）。',
        },
        format: {
          type: 'string',
          enum: ['speckit', 'openspec', 'spec', 'skill'],
          default: 'speckit',
          description: '导出格式：speckit / openspec / spec / skill。',
        },
        name: {
          type: 'string',
          description: '工作流名称（用于生成目录与文件名）。',
        },
        targetDir: {
          type: 'string',
          description: '导出目标目录（用户项目根目录的绝对路径），产物将写入其下。',
        },
        description: {
          type: 'string',
          description: '仅 skill 格式：SKILL.md frontmatter description，缺省按节点自动生成。',
        },
      },
      required: ['workflow', 'name', 'targetDir'],
    },
  },
]

async function handle(msg) {
  const { method, params = {}, id } = msg
  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      }
    case 'notifications/initialized':
      return null
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} }
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } }
    case 'tools/call': {
      const { name, arguments: args = {} } = params
      let result
      if (name === 'workflow_build') result = await buildWorkflow(args)
      else if (name === 'workflow_export') result = await exportWorkflow(args)
      else throw new Error(`未知工具: ${name}`)
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
      }
    }
    default:
      if (id !== undefined) {
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `未知方法: ${method}` } }
      }
      return null
  }
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

async function handleAndSend(msg) {
  try {
    const res = await handle(msg)
    if (res) send(res)
  } catch (err) {
    if (msg.id !== undefined) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: err.message } })
    }
  }
}

// 串行队列：保证每条消息按序处理、响应按序输出
// （stdin 关闭后不强制退出：等待 pending 的异步任务（Runner 调用）完成，事件循环自然结束）
let queue = Promise.resolve()
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    return // 忽略非 JSON 行
  }
  queue = queue.then(() => handleAndSend(msg))
})
