import { createFileRoute } from '@tanstack/react-router'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, tool, isLoopFinished } from 'ai'
import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * CodeAgent API
 * 使用 Vercel AI SDK 的 generateText + Tool Calling 实现 AI 自主探索项目代码。
 * SDK 自动处理：工具调用 → 执行 → 结果回传 → 继续的完整循环。
 *
 * 系统提示词从 prompts/codeAgent.md 读取，可在「规则与记忆」页面编辑。
 */

const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts')
const CODE_AGENT_PROMPT_PATH = path.join(PROMPTS_DIR, 'codeAgent.md')

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

/** 从模型 URL 中提取 OpenAI 兼容的 base URL */
function extractBaseUrl(rawUrl: string): string {
  let url = rawUrl.replace(/\/chat\/completions\/?$/i, '')
  url = url.replace(/\/+$/, '')
  if (!url.endsWith('/v1')) {
    url += '/v1'
  }
  return url
}

/** 安全校验：检查路径穿越 */
function isPathSafe(filePath: string): boolean {
  return !filePath.includes('..')
}

export const Route = createFileRoute('/api/execute/codeAgent')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { projectPath, instruction, maxIterations = 20, modal } = body

        const logs: string[] = []
        logs.push(`CodeAgent 开始执行`)
        logs.push(`项目路径: ${projectPath || '未设置'}`)
        logs.push(`分析指令: ${instruction}`)
        logs.push(`最大迭代次数: ${maxIterations}`)

        if (!modal?.name || !modal?.url) {
          return Response.json({
            status: 'error',
            output: {},
            logs: [...logs, '模型配置不完整'],
            error: '模型配置不完整',
          })
        }

        logs.push(`模型: ${modal.name}`)

        // 构建 AI SDK 模型实例
        const baseUrl = extractBaseUrl(modal.url)
        const provider = createOpenAI({
          baseURL: baseUrl,
          apiKey: modal.key || '',
        })
        const model = provider(modal.modelName || modal.name)

        // 从 prompts/codeAgent.md 加载系统提示词
        const systemPrompt = await loadSystemPrompt(projectPath)

        try {
          const result = await generateText({
            model,
            system: systemPrompt,
            prompt: `${instruction}\n\n${projectPath ? `项目的根路径是: ${projectPath}，请开始探索分析。` : '请先使用 list_directory 查看当前目录结构。'}`,
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
            },
          })

          const stepCount = (result as any).steps?.length || 1
          logs.push(`AI 分析完成 (${stepCount} 轮工具调用)`)

          if (result.usage) {
            logs.push(`Token 用量: 输入 ${result.usage.inputTokens || 0} / 输出 ${result.usage.outputTokens || 0} / 总计 ${result.usage.totalTokens || 0}`)
          }

          return Response.json({
            status: 'success',
            output: {
              response: result.text,
              model: modal.name,
              iterations: stepCount,
              usage: result.usage
                ? {
                    promptTokens: result.usage.inputTokens,
                    completionTokens: result.usage.outputTokens,
                    totalTokens: result.usage.totalTokens,
                  }
                : undefined,
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

/** 基于 isStepCount 的停止条件 */
function isStepCount(maxSteps: number) {
  let count = 0
  return () => {
    count++
    return count > maxSteps
  }
}
