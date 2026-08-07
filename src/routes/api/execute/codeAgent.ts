import { createFileRoute } from '@tanstack/react-router'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, tool, isLoopFinished } from 'ai'
import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { extractBaseUrl } from '#/services/ai'
import {
  parseTasks,
  formatBatch,
  markBatchDone,
  getNextBatch,
} from '#/services/taskManager'

/**
 * CodeAgent API
 * 使用 Vercel AI SDK 的 generateText + Tool Calling 实现 AI 自主探索/修改项目代码。
 * SDK 自动处理：工具调用 → 执行 → 结果回传 → 继续的完整循环。
 *
 * 两种模式（节点 data.mode）：
 * - analyze（默认）：只读探索分析，系统提示词 prompts/codeAgent.md
 * - batch：按 tasks.md 批次实现代码，系统提示词 prompts/codeBatch.md，
 *   每批完成后 tasks.md 打勾（进度持久化）、git diff 记录到 specRoot/session/
 */

const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts')
const CODE_AGENT_PROMPT_PATH = path.join(PROMPTS_DIR, 'codeAgent.md')
const CODE_BATCH_PROMPT_PATH = path.join(PROMPTS_DIR, 'codeBatch.md')

/** 从 prompts 目录加载系统提示词 */
async function loadSystemPrompt(projectPath?: string): Promise<string> {
  let basePrompt = ''
  try {
    basePrompt = await fs.readFile(CODE_AGENT_PROMPT_PATH, 'utf-8')
  } catch {
    // 文件不存在时使用默认提示词
    basePrompt = `你是一个专业的代码分析助手。你的任务是通过调用文件系统工具来探索和分析项目代码。`
  }

  if (projectPath) {
    basePrompt += `\n\n## 项目路径\n当前分析的项目根路径为: ${projectPath}\n请从这个路径开始探索。`
  }

  return basePrompt
}

/** 从 prompts 目录加载 batch 模式系统提示词 */
async function loadBatchSystemPrompt(projectRoot: string): Promise<string> {
  let basePrompt = ''
  try {
    basePrompt = await fs.readFile(CODE_BATCH_PROMPT_PATH, 'utf-8')
  } catch {
    basePrompt = `你是一个批量代码实现工程师。按任务清单逐个实现代码，使用提供的工具读写项目文件。`
  }
  return `${basePrompt}\n\n## 项目根路径\n${projectRoot}\n本次编码的代码仓库根目录。所有读写路径都必须位于该目录内。`
}

/** 安全校验：检查路径穿越 */
function isPathSafe(filePath: string): boolean {
  return !filePath.includes('..')
}

/** 校验目标路径是否位于项目根目录内（防 AI 越界写文件） */
function isInsideRoot(resolvedPath: string, root: string): boolean {
  const rel = path.relative(root, resolvedPath)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** 收集当前工作区 git diff（用于 batch 模式记录每批改动） */
function collectGitDiff(root: string): string {
  try {
    const stat = execSync('git diff --stat HEAD', {
      cwd: root,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()
    const full = execSync('git diff HEAD', {
      cwd: root,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()
    return `## 改动统计\n${stat || '（无未提交改动）'}\n\n## 完整 diff\n${full.slice(0, 50000)}`
  } catch (err: any) {
    return `（获取 git diff 失败: ${err.message}）`
  }
}

export const Route = createFileRoute('/api/execute/codeAgent')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const {
          projectPath,
          branch,
          instruction,
          maxIterations = 20,
          modal,
          upstreamContext,
          // analyze 应用地图开关（默认开启）
          useAppMap = true,
          // batch 模式专用
          mode,
          tasksMarkdown,
          specRoot,
        } = body

        const logs: string[] = []

        if (!modal?.name || !modal?.url) {
          return Response.json({
            status: 'error',
            output: {},
            logs: [...logs, '模型配置不完整'],
            error: '模型配置不完整',
          })
        }

        // batch 模式走独立分支：按 tasks.md 批次实现代码
        if (mode === 'batch') {
          return handleBatchMode({
            projectPath,
            branch,
            instruction,
            maxIterations,
            modal,
            upstreamContext,
            tasksMarkdown,
            specRoot,
            useAppMap,
          })
        }

        // ================= analyze 模式（原有逻辑，保持不动） =================
        logs.push(`CodeAgent 开始执行`)
        logs.push(`项目路径: ${projectPath || '未设置'}`)
        if (branch) logs.push(`Git 分支: ${branch}`)
        logs.push(`分析指令: ${instruction}`)

        // 如果有上游上下文，将其融入分析指令
        let enrichedInstruction = instruction
        if (upstreamContext) {
          const parts: string[] = []
          const upstreams: any[] = upstreamContext.upstreams || []
          // 优先使用上游的 response（二次分析的变更范围分析）
          if (upstreamContext.response) {
            parts.push(`## 需求变更范围分析\n${upstreamContext.response}`)
          } else {
            // 回退：从祖先链中找第一个智能体节点的 response（如需求分析）
            const agentUpstream = upstreams.find((u: any) => typeof u.response === 'string' && u.response)
            if (agentUpstream) {
              parts.push(`## 需求分析\n${agentUpstream.response}`)
            }
          }
          // 输出格式模板：优先顶层，其次从祖先链中查找（模板节点可能不在直接前驱中）
          let templateContent = upstreamContext.templateContent
          if (!templateContent) {
            const templateUpstream = upstreams.find((u: any) => typeof u.templateContent === 'string' && u.templateContent)
            templateContent = templateUpstream?.templateContent
          }
          if (templateContent) {
            parts.push(`## 推荐输出格式\n请参考以下模板结构组织你的分析结果：\n${templateContent}`)
          }
          if (parts.length > 0) {
            enrichedInstruction = `${instruction}\n\n## 需求分析与代码分析结合\n以下是上游输出的需求分析结果，请基于这些需求去探索代码仓库，找出需要修改的组件、文件、接口，并输出一份完整的技术方案文档。\n\n${parts.join('\n\n')}`
            logs.push(`已融入上游上下文进行分析`)
          }
        }
        logs.push(`最大迭代次数: ${maxIterations}`)
        logs.push(`模型: ${modal.name}`)

        // 构建 AI SDK 模型实例
        const baseUrl = extractBaseUrl(modal.url)
        const provider = createOpenAI({
          baseURL: baseUrl,
          apiKey: modal.key || '',
        })
        const model = provider.chat(modal.modelName || modal.name)

        // 从 prompts/codeAgent.md 加载系统提示词
        const baseSystemPrompt = await loadSystemPrompt(projectPath)

        // 如果指定了分支，先切换 Git 分支（应用地图扫描基于目标分支代码）
        if (projectPath && branch) {
          try {
            const branchDir = path.isAbsolute(projectPath) ? projectPath : path.resolve(process.cwd(), projectPath)
            logs.push(`切换分支到: ${branch}`)
            execSync(`git switch "${branch}" 2>/dev/null || git checkout "${branch}"`, {
              cwd: branchDir,
              stdio: 'pipe',
            })
            logs.push(`分支已切换: ${branch}`)
          } catch (err: any) {
            logs.push(`切换分支失败: ${err.message}，将继续使用当前分支`)
          }
        }

        // 应用地图（App-Desc，P1-2）：检测项目中的应用地图，有则注入使用；
        // 没有则在 analyze 的同时扫描仓库结构 + LLM 生成初版写回项目
        let appMapSection = ''
        if (useAppMap && projectPath) {
          const projectRoot = path.isAbsolute(projectPath)
            ? path.resolve(projectPath)
            : path.resolve(process.cwd(), projectPath)
          appMapSection = await ensureAppDesc(model, projectRoot, logs)
        }
        const systemPrompt = appMapSection
          ? `${baseSystemPrompt}\n\n## 应用地图\n${appMapSection}\n\n分析过程中请以应用地图中的模块划分和 zone 约束为准：zone=old 的区域不主动改动，zone=transition 的区域仅在任务明确涉及的范围内修改，不做无关重构。`
          : baseSystemPrompt

        try {
          const result = await generateText({
            model,
            system: systemPrompt,
            prompt: `${enrichedInstruction}\n\n${projectPath ? `项目的根路径是: ${projectPath}，请开始探索分析。` : '请先使用 list_directory 查看当前目录结构。'}`,
            // 通过 maxTokens 控制输出长度
            ...(modal.token?.max ? { maxTokens: modal.token.max } : {}),
            // 停止条件：让循环自然结束（AI 不再调用工具时）
            stopWhen: [isLoopFinished(), isStepCount(maxIterations)],
            tools: {
              list_directory: tool({
                description: '列出指定目录下的文件和子目录。返回每个项目的名称、类型（文件/目录）。适用于探索项目结构。',
                inputSchema: z.object({
                  path: z.string().describe('要列出的目录路径（绝对路径）'),
                }),
                execute: async ({ path: dirPath }) => {
                  if (!isPathSafe(dirPath)) {
                    throw new Error('路径安全校验失败: 检测到路径穿越尝试')
                  }

                  const resolvedPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath)
                  const stat = await fs.stat(resolvedPath)

                  if (!stat.isDirectory()) {
                    throw new Error(`路径不是目录: ${dirPath}`)
                  }

                  const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
                  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
                  const files = entries.filter(e => e.isFile()).map(e => e.name)

                  let output = `目录: ${resolvedPath}\n`
                  output += `子目录 (${dirs.length}): ${dirs.length > 0 ? '\n  ' + dirs.join('\n  ') : '无'}\n`
                  output += `文件 (${files.length}): ${files.length > 0 ? '\n  ' + files.slice(0, 50).join('\n  ') : '无'}`
                  if (files.length > 50) {
                    output += `\n  ... 及另外 ${files.length - 50} 个文件`
                  }

                  return output
                },
              }),
              read_file: tool({
                description: '读取指定文件的内容。可以指定行范围来读取部分内容，不指定则读取整个文件。适用于查看源代码、配置文件等。',
                inputSchema: z.object({
                  path: z.string().describe('要读取的文件路径（绝对路径）'),
                  start_line: z.number().int().positive().optional().describe('起始行号（从 1 开始），不传则从第一行开始'),
                  end_line: z.number().int().positive().optional().describe('结束行号（包含），不传则读取到最后一行'),
                }),
                execute: async ({ path: filePath, start_line, end_line }) => {
                  if (!isPathSafe(filePath)) {
                    throw new Error('路径安全校验失败: 检测到路径穿越尝试')
                  }

                  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
                  const stat = await fs.stat(resolvedPath)

                  if (stat.isDirectory()) {
                    throw new Error(`路径是目录而非文件: ${filePath}。请使用 list_directory 工具探索目录。`)
                  }

                  const content = await fs.readFile(resolvedPath, 'utf-8')
                  const allLines = content.split('\n')
                  const totalLines = allLines.length

                  if (start_line != null || end_line != null) {
                    const start = Math.max(0, (start_line || 1) - 1)
                    const end = Math.min(totalLines, end_line || totalLines)
                    const snippet = allLines.slice(start, end).join('\n')
                    return `文件: ${resolvedPath}\n总行数: ${totalLines}\n读取范围: 行 ${start + 1}-${end}\n\n${snippet}`
                  }

                  return `文件: ${resolvedPath}\n总行数: ${totalLines}\n\n${content}`
                },
              }),
              git_checkout: tool({
                description: '切换到 Git 仓库的指定分支。适用于需要查看不同分支代码的场景。注意：这会影响当前工作目录的分支状态。',
                inputSchema: z.object({
                  branch: z.string().describe('要切换到的分支名，如 main、develop、feature/xxx'),
                }),
                execute: async ({ branch: targetBranch }) => {
                  if (!projectPath) {
                    throw new Error('项目路径未配置，无法切换分支')
                  }
                  const repoDir = path.isAbsolute(projectPath) ? projectPath : path.resolve(process.cwd(), projectPath)
                  execSync(`git switch "${targetBranch}" 2>/dev/null || git checkout "${targetBranch}"`, {
                    cwd: repoDir,
                    stdio: 'pipe',
                  })
                  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoDir, encoding: 'utf-8' }).trim()
                  return `已切换到分支: ${currentBranch}`
                },
              }),
            },
          })

          const stepCount = (result as any).steps?.length || 1
          logs.push(`AI 分析完成 (${stepCount} 轮工具调用)`)

          logs.push(`Token 用量: 输入 ${result.usage.inputTokens || 0} / 输出 ${result.usage.outputTokens || 0} / 总计 ${result.usage.totalTokens || 0}`)

          // 达到迭代上限且最后一步仍在调用工具 → 分析被截断，输出不完整，
          // 必须标记 error，避免把中间叙述当作分析结果传播给下游节点。
          // 中间输出保留在 partialResponse 供执行结果页查看，response 置空
          if (isTruncatedByStepCap(result, maxIterations)) {
            logs.push(`达到最大迭代次数（${maxIterations}），分析未完成即被截断`)
            return Response.json({
              status: 'error',
              output: {
                // 未完成：response 为空字符串（不完整的分析不得作为最终结果），中间输出单独保留
                response: '',
                partialResponse: result.text,
                model: modal.name,
                iterations: stepCount,
                projectPath,
                truncated: true,
              },
              logs,
              error: `达到最大迭代次数（${maxIterations}）时仍在进行工具调用，分析未完成。请增大「最大迭代次数」或缩小分析范围后重试。`,
            })
          }

          return Response.json({
            status: 'success',
            output: {
              response: result.text,
              model: modal.name,
              iterations: stepCount,
              usage: {
                promptTokens: result.usage.inputTokens,
                completionTokens: result.usage.outputTokens,
                totalTokens: result.usage.totalTokens,
              },
              projectPath,
            },
            logs,
          })
        } catch (err: any) {
          logs.push(`执行失败: ${err.message}`)
          return Response.json({
            status: 'error',
            output: {},
            logs,
            error: `CodeAgent 执行失败: ${err.message}`,
          })
        }
      },
    },
  },
})

// ================= batch 模式 =================

type BatchModeInput = {
  projectPath?: string
  branch?: string
  instruction?: string
  maxIterations?: number
  modal?: any
  upstreamContext?: any
  tasksMarkdown?: string
  specRoot?: string
  /** 应用地图开关（默认开启：有 app-desc 则注入使用，无则不生成） */
  useAppMap?: boolean
}

/** batch 模式：按 tasks.md 批次实现代码，每批打勾 + diff 记录 */
async function handleBatchMode(input: BatchModeInput) {
  const {
    projectPath,
    branch,
    instruction,
    maxIterations = 20,
    modal,
    upstreamContext,
    tasksMarkdown,
    specRoot,
    useAppMap = true,
  } = input

  const logs: string[] = []
  logs.push(`CodeAgent · batch 模式开始执行`)

  if (!projectPath) {
    return Response.json({
      status: 'error',
      output: {},
      logs: [...logs, 'batch 模式必须配置项目路径（要写入的代码仓库）'],
      error: 'batch 模式必须配置项目路径',
    })
  }

  if (!tasksMarkdown || String(tasksMarkdown).trim().length === 0) {
    return Response.json({
      status: 'error',
      output: {},
      logs: [...logs, 'batch 模式缺少 tasks.md 输入，请连接「任务拆解」节点或确保 Spec 目录存在 tasks.md'],
      error: '缺少 tasks.md 输入',
    })
  }

  const projectRoot = path.isAbsolute(projectPath)
    ? path.resolve(projectPath)
    : path.resolve(process.cwd(), projectPath)

  // 1. 解析任务批次（跳过已打勾的批次 = 断点续跑）
  const batches = parseTasks(tasksMarkdown)
  if (batches.length === 0) {
    return Response.json({
      status: 'error',
      output: {},
      logs: [...logs, 'tasks.md 无法解析出批次（需要 "## Batch N" 标题）'],
      error: 'tasks.md 无法解析',
    })
  }
  logs.push(`解析到 ${batches.length} 个批次，共 ${batches.reduce((n, b) => n + b.tasks.length, 0)} 个任务`)
  logs.push(`项目路径: ${projectRoot}`)
  if (branch) logs.push(`Git 分支: ${branch}`)
  logs.push(`模型: ${modal.name}`)

  // 2. 构建模型
  const baseUrl = extractBaseUrl(modal.url)
  const provider = createOpenAI({
    baseURL: baseUrl,
    apiKey: modal.key || '',
  })
  const model = provider.chat(modal.modelName || modal.name)

  // 3. 加载 batch 系统提示词
  let systemPrompt = await loadBatchSystemPrompt(projectRoot)

  // 应用地图（P1-2）：Switch 开启且项目已有 app-desc 则注入使用；没有不生成
  if (useAppMap) {
    const appMapSection = await readAppDesc(projectRoot, logs)
    if (appMapSection) {
      systemPrompt = `${systemPrompt}\n\n${appMapSection}\n\n编码过程中请以应用地图中的模块划分和 zone 约束为准：zone=old 的区域不主动改动，zone=transition 的区域仅在任务明确涉及的范围内修改，不做无关重构。`
    } else {
      logs.push('项目无应用地图（app-desc），batch 模式不生成；需要时可先用 analyze 模式生成')
    }
  }

  // 4. 先切换分支（如指定）
  if (branch) {
    try {
      logs.push(`切换分支到: ${branch}`)
      execSync(`git switch "${branch}" 2>/dev/null || git checkout "${branch}"`, {
        cwd: projectRoot,
        stdio: 'pipe',
      })
      logs.push(`分支已切换: ${branch}`)
    } catch (err: any) {
      logs.push(`切换分支失败: ${err.message}，将继续使用当前分支`)
    }
  }

  // 5. batch 模式工具集：只读工具 + 写文件/编辑/diff
  const batchTools = {
    list_directory: tool({
      description: '列出指定目录下的文件和子目录。适用于定位目标文件。',
      inputSchema: z.object({
        path: z.string().describe('要列出的目录路径（绝对路径）'),
      }),
      execute: async ({ path: dirPath }: { path: string }) => {
        const resolved = path.isAbsolute(dirPath) ? dirPath : path.resolve(projectRoot, dirPath)
        if (!isInsideRoot(resolved, projectRoot)) {
          throw new Error(`路径越界: ${dirPath}，必须在项目根目录内`)
        }
        const stat = await fs.stat(resolved)
        if (!stat.isDirectory()) throw new Error(`路径不是目录: ${dirPath}`)
        const entries = await fs.readdir(resolved, { withFileTypes: true })
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
        const files = entries.filter((e) => e.isFile()).map((e) => e.name)
        let output = `目录: ${resolved}\n`
        output += `子目录 (${dirs.length}): ${dirs.length > 0 ? '\n  ' + dirs.join('\n  ') : '无'}\n`
        output += `文件 (${files.length}): ${files.length > 0 ? '\n  ' + files.slice(0, 50).join('\n  ') : '无'}`
        if (files.length > 50) output += `\n  ... 及另外 ${files.length - 50} 个文件`
        return output
      },
    }),
    read_file: tool({
      description: '读取指定文件的内容，可指定行范围。适用于查看源代码、配置文件等。',
      inputSchema: z.object({
        path: z.string().describe('要读取的文件路径（绝对路径）'),
        start_line: z.number().int().positive().optional().describe('起始行号（从 1 开始）'),
        end_line: z.number().int().positive().optional().describe('结束行号（包含）'),
      }),
      execute: async ({ path: filePath, start_line, end_line }: { path: string; start_line?: number; end_line?: number }) => {
        const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath)
        if (!isInsideRoot(resolved, projectRoot)) {
          throw new Error(`路径越界: ${filePath}，必须在项目根目录内`)
        }
        const stat = await fs.stat(resolved)
        if (stat.isDirectory()) throw new Error(`路径是目录而非文件: ${filePath}`)
        const content = await fs.readFile(resolved, 'utf-8')
        const allLines = content.split('\n')
        const totalLines = allLines.length
        if (start_line != null || end_line != null) {
          const start = Math.max(0, (start_line || 1) - 1)
          const end = Math.min(totalLines, end_line || totalLines)
          const snippet = allLines.slice(start, end).join('\n')
          return `文件: ${resolved}\n总行数: ${totalLines}\n读取范围: 行 ${start + 1}-${end}\n\n${snippet}`
        }
        return `文件: ${resolved}\n总行数: ${totalLines}\n\n${content}`
      },
    }),
    write_file: tool({
      description: '新建文件或整体覆盖写入文件内容。适用于新文件或小文件整体重写。路径必须在项目根目录内。',
      inputSchema: z.object({
        path: z.string().describe('目标文件路径（绝对路径，必须在项目根目录内）'),
        content: z.string().describe('完整文件内容'),
      }),
      execute: async ({ path: filePath, content }: { path: string; content: string }) => {
        const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath)
        if (!isInsideRoot(resolved, projectRoot)) {
          throw new Error(`路径越界: ${filePath}，禁止写入项目根目录之外`)
        }
        await fs.mkdir(path.dirname(resolved), { recursive: true })
        await fs.writeFile(resolved, content, 'utf-8')
        return `已写入文件: ${resolved}（${content.length} 字符）`
      },
    }),
    edit_file: tool({
      description: '替换已有文件的指定行范围（start_line 到 end_line，含两端）。范围之外的内容保持不变，适合大文件局部修改。',
      inputSchema: z.object({
        path: z.string().describe('目标文件路径（绝对路径，必须在项目根目录内）'),
        start_line: z.number().int().positive().describe('起始行号（从 1 开始）'),
        end_line: z.number().int().positive().describe('结束行号（包含）'),
        content: z.string().describe('用于替换 [start_line, end_line] 的新内容'),
      }),
      execute: async ({ path: filePath, start_line, end_line, content }: { path: string; start_line: number; end_line: number; content: string }) => {
        const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath)
        if (!isInsideRoot(resolved, projectRoot)) {
          throw new Error(`路径越界: ${filePath}，禁止写入项目根目录之外`)
        }
        const allLines = (await fs.readFile(resolved, 'utf-8')).split('\n')
        const start = Math.max(0, start_line - 1)
        const end = Math.min(allLines.length, end_line)
        if (start > end) throw new Error(`行范围无效: ${start_line}-${end_line}`)
        const newLines = [
          ...allLines.slice(0, start),
          ...content.split('\n'),
          ...allLines.slice(end),
        ]
        await fs.writeFile(resolved, newLines.join('\n'), 'utf-8')
        return `已替换 ${resolved} 的第 ${start_line}-${end_line} 行（原 ${end - start} 行 → 新 ${content.split('\n').length} 行）`
      },
    }),
    git_diff: tool({
      description: '查看当前工作区相对 HEAD 的改动统计（git diff --stat），用于确认本批修改范围是否符合预期。',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return (
            execSync('git diff --stat HEAD', {
              cwd: projectRoot,
              encoding: 'utf-8',
              stdio: 'pipe',
            }).trim() || '（无未提交改动）'
          )
        } catch (err: any) {
          return `获取 diff 失败: ${err.message}`
        }
      },
    }),
    git_checkout: tool({
      description: '切换到 Git 仓库的指定分支。注意：这会影响当前工作目录的分支状态。',
      inputSchema: z.object({
        branch: z.string().describe('要切换到的分支名，如 main、develop、feature/xxx'),
      }),
      execute: async ({ branch: targetBranch }: { branch: string }) => {
        execSync(`git switch "${targetBranch}" 2>/dev/null || git checkout "${targetBranch}"`, {
          cwd: projectRoot,
          stdio: 'pipe',
        })
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot, encoding: 'utf-8' }).trim()
        return `已切换到分支: ${currentBranch}`
      },
    }),
  }

  // 6. 循环执行批次（getNextBatch 天然跳过已打勾批次 → 断点续跑）
  let currentMd = String(tasksMarkdown)
  const completedBatches: number[] = []
  const diffRecords: { batchIndex: number; diff: string }[] = []
  const batchLogs: { batchIndex: number; text: string }[] = []
  let fromIndex = 0

  for (;;) {
    const batch = getNextBatch(parseTasks(currentMd), fromIndex)
    if (!batch) break

    logs.push(`>>> 正在执行 Batch ${batch.index}/${batches.length}（${batch.tasks.length} 个任务）`)

    // 组装本批 prompt：任务清单 + 上游需求上下文 + 用户补充指令
    let prompt = `请实现以下批次的任务清单。\n\n${formatBatch(batch)}`
    if (upstreamContext?.response) {
      prompt += `\n\n## 上游需求上下文\n${String(upstreamContext.response).slice(0, 20000)}`
    }
    if (instruction) {
      prompt += `\n\n## 用户补充指令\n${instruction}`
    }

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt,
        ...(modal.token?.max ? { maxTokens: modal.token.max } : {}),
        stopWhen: [isLoopFinished(), isStepCount(maxIterations)],
        tools: batchTools,
      })

      // 本批被截断（达到迭代上限仍在调用工具）→ 任务可能未实现完，
      // 不能打勾标记完成，停止后续批次（已完成的批次进度保留，可增大迭代次数后续跑）
      if (isTruncatedByStepCap(result, maxIterations)) {
        logs.push(
          `Batch ${batch.index} 达到最大迭代次数被截断，本批未标记完成。请增大「最大迭代次数」或缩小本批任务范围后重跑续跑`,
        )
        break
      }

      // 本批完成：打勾 + 记录 diff
      currentMd = markBatchDone(currentMd, batch.index)
      const diffText = collectGitDiff(projectRoot)
      completedBatches.push(batch.index)
      diffRecords.push({ batchIndex: batch.index, diff: diffText })
      batchLogs.push({ batchIndex: batch.index, text: result.text })
      logs.push(`Batch ${batch.index} 完成（${(result as any).steps?.length || 1} 轮工具调用）`)

      // diff 落盘到 Spec 目录 session/（可选）
      if (specRoot) {
        try {
          const sessionDir = path.join(specRoot, 'session')
          await fs.mkdir(sessionDir, { recursive: true })
          await fs.writeFile(
            path.join(sessionDir, `batch-${batch.index}.md`),
            `# Batch ${batch.index} 代码改动\n\n${diffText}\n\n## 执行汇报\n\n${result.text}`,
            'utf-8',
          )
          logs.push(`Batch ${batch.index} diff 已记录到 session/batch-${batch.index}.md`)
        } catch (err: any) {
          logs.push(`diff 记录失败（已忽略）: ${err.message}`)
        }
      }
    } catch (err: any) {
      logs.push(`Batch ${batch.index} 执行失败: ${err.message}`)
      logs.push('已停止后续批次（已完成批次的任务打勾已持久化，可修复后重跑续跑）')
      break
    }

    fromIndex = batch.index
  }

  // 7. 打勾后的 tasks.md 写回 Spec 目录（进度持久化，供续跑）
  if (specRoot) {
    try {
      await fs.writeFile(path.join(specRoot, 'tasks.md'), currentMd, 'utf-8')
      logs.push('tasks.md 进度已写回 Spec 目录')
    } catch (err: any) {
      logs.push(`tasks.md 写回失败（已忽略）: ${err.message}`)
    }
  }

  const summary =
    completedBatches.length > 0
      ? `Batch 编码完成（${completedBatches.length}/${batches.length} 批次）。\n\n已完成批次：\n${completedBatches
          .map((i) => `- Batch ${i}`)
          .join('\n')}\n\n各批次汇报：\n${batchLogs
          .map((b) => `### Batch ${b.batchIndex}\n${b.text}`)
          .join('\n\n')}`
      : '没有可执行的批次（全部已完成或解析失败）'

  return Response.json({
    status: completedBatches.length > 0 ? 'success' : 'error',
    output: {
      response: summary,
      mode: 'batch',
      completedBatches,
      totalBatches: batches.length,
      // 打勾后的 tasks.md 全文（executor 可写回 Spec 目录或累积给下游）
      tasksMarkdown: currentMd,
      diffRecords,
      model: modal.name,
      projectPath,
    },
    logs,
    ...(completedBatches.length === 0 ? { error: '没有可执行的批次（tasks.md 可能已全部完成）' } : {}),
  })
}

/** 基于 isStepCount 的停止条件 */
function isStepCount(maxSteps: number) {
  let count = 0
  return () => {
    count++
    return count > maxSteps
  }
}

/**
 * 判断工具调用循环是否因达到迭代上限被截断。
 * 特征：步骤数达到上限，且最后一步仍在调用工具（未自然产出最终文本）。
 * 截断时 result.text 只是中间叙述，不能当作完整输出传播给下游。
 */
function isTruncatedByStepCap(result: any, maxIterations: number): boolean {
  const steps: any[] = result?.steps || []
  if (steps.length < maxIterations) return false
  const last = steps[steps.length - 1]
  if (!last) return false
  const toolCalls: any[] =
    last.toolCalls ||
    (last.parts || []).filter((p: any) => p.type === 'tool-call') ||
    []
  return toolCalls.length > 0
}

// ================= 应用地图（App-Desc，P1-2） =================

/** 扫描项目目录结构为缩进文本树（过滤噪音目录，限制深度与总量） */
async function scanProjectTree(root: string): Promise<string> {
  const IGNORED = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.output',
    '.nuxt',
    '.next',
    '.turbo',
    '.cache',
    'vendor',
    'target',
  ])
  const lines: string[] = []
  const MAX_LINES = 400
  const MAX_DEPTH = 4

  async function walk(dir: string, rel: string, depth: number) {
    if (depth > MAX_DEPTH || lines.length >= MAX_LINES) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    const dirs = entries
      .filter((e) => e.isDirectory() && !IGNORED.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))
    const files = entries
      .filter((e) => e.isFile())
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const ent of [...dirs, ...files]) {
      if (lines.length >= MAX_LINES) return
      const childRel = rel ? `${rel}/${ent.name}` : ent.name
      if (ent.isDirectory()) {
        lines.push(`${'  '.repeat(depth)}${ent.name}/`)
        await walk(path.join(dir, ent.name), childRel, depth + 1)
      } else {
        // 文件：只列关键配置与源码（首层文件全列，深层仅常见源码文件）
        if (
          depth === 0 ||
          /\.(ts|tsx|js|jsx|vue|json|md|yml|yaml|css|scss|html|py|java|go|rs|c|h|cpp)$/.test(
            ent.name,
          )
        ) {
          lines.push(`${'  '.repeat(depth)}${ent.name}`)
        }
      }
    }
  }

  await walk(root, '', 0)
  return lines.join('\n')
}

/** 从 LLM 输出中提取 JSON 文本（兼容 ```json 围栏） */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

/** 应用地图生成提示词（产出 JSON，schema 与 roadMap P1-2 对齐） */
const APP_DESC_SYSTEM_PROMPT = `你是应用架构分析专家。基于给出的项目目录结构与依赖，生成该应用的「应用地图」（App-Desc），用于指导 AI 编码代理理解代码库分区与技术约束。
只输出一个 JSON 对象，不要输出任何其他文字、解释或 markdown 围栏。JSON 结构如下：
{
  "app": "应用/仓库名",
  "modules": [
    { "name": "模块名", "path": "相对路径", "zone": "new", "keyFiles": ["相对路径"] }
  ],
  "dependencies": ["依赖名"],
  "law": { "技术约束": "说明" }
}
规则：
- modules 按代码目录/模块粒度拆分，path 为相对项目根目录的路径
- zone 取值 new（按新规作业）/ transition（过渡）/ old（存量不主动改），默认 new；明显是遗留/低层公共代码的可标 transition
- keyFiles 填该模块的关键文件（相对路径），1-3 个
- dependencies 从 package.json 或明显依赖目录归纳，最多列 20 个
- law 填从配置/代码能看出的硬性技术约束（如框架版本、语法风格限制），没有可省略
不要臆造；不确定的字段宁缺毋滥。`

/** 生成应用地图初版（一次 LLM 调用，不循环工具） */
async function generateAppDesc(
  model: any,
  root: string,
): Promise<{ text: string; error?: string }> {
  const tree = await scanProjectTree(root)
  let deps = ''
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8'))
    deps = Object.keys(pkg.dependencies || {})
      .concat(Object.keys(pkg.devDependencies || {}))
      .slice(0, 40)
      .join(', ')
  } catch {
    // 无 package.json 时跳过依赖说明
  }
  try {
    const result = await generateText({
      model,
      system: APP_DESC_SYSTEM_PROMPT,
      prompt: `## 项目目录结构\n${tree || '（目录为空）'}\n\n## 顶层依赖\n${deps || '（无 package.json 或无法读取）'}\n\n请生成该项目的应用地图 JSON。`,
    })
    return { text: result.text }
  } catch (err: any) {
    return { text: '', error: err.message }
  }
}

/** 读取项目已有的应用地图（app-desc.json / app-desc.yaml），不存在返回空字符串（不生成） */
async function readAppDesc(root: string, logs: string[]): Promise<string> {
  for (const file of ['app-desc.json', 'app-desc.yaml']) {
    const fp = path.join(root, file)
    try {
      const content = await fs.readFile(fp, 'utf-8')
      if (content.trim()) {
        logs.push(`已加载项目应用地图: ${file}`)
        return `## 项目应用地图（${file}）\n${content.trim().slice(0, 20000)}`
      }
    } catch {
      // 不存在，继续
    }
  }
  return ''
}

/**
 * 确保项目存在应用地图：
 * - 已有 app-desc.json / app-desc.yaml → 读取并注入（yaml 以原文文本注入，不结构化解析）
 * - 没有 → 扫描仓库结构 + LLM 生成初版写回 app-desc.json
 * 返回注入到系统提示词的地图文本；失败返回空字符串（不阻塞 analyze）
 */
async function ensureAppDesc(
  model: any,
  root: string,
  logs: string[],
): Promise<string> {
  // 1. 已存在：直接读取使用
  const existing = await readAppDesc(root, logs)
  if (existing) return existing

  // 2. 不存在：扫描 + LLM 生成初版
  logs.push('项目未配置应用地图（app-desc），正在生成初版...')
  const { text, error } = await generateAppDesc(model, root)
  if (error || !text.trim()) {
    logs.push(`应用地图生成失败（已跳过，不影响本次分析）: ${error || '空输出'}`)
    return ''
  }

  const json = extractJson(text)
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.modules)) {
      throw new Error('缺少 modules 数组')
    }
  } catch (err: any) {
    logs.push(`应用地图 JSON 校验失败（已跳过，可手动创建 app-desc.json）: ${err.message}`)
    return ''
  }

  try {
    await fs.writeFile(path.join(root, 'app-desc.json'), json, 'utf-8')
    logs.push('应用地图初版已写入项目: app-desc.json（请人工确认后微调 zone/模块划分）')
  } catch (err: any) {
    logs.push(`应用地图写回项目失败（已跳过）: ${err.message}`)
  }
  return `## 项目应用地图（app-desc.json，初版）\n${json}`
}
