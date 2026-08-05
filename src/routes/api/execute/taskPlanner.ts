import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import { callAI } from '#/services/ai'

/** 结构化校验：确保 tasks.md 有 ## Batch、- [ ] T- 且每个任务带 文件/前置/验收 三要素 */
function validateTasks(
  md: string,
): { ok: boolean; batchCount: number; taskCount: number; warnings: string[] } {
  const warnings: string[] = []

  const batchCount = (md.match(/^## Batch\s+\d+/gm) || []).length
  const taskLines = md.match(/^- \[ \]\s*T-\d+/gm) || []
  const taskCount = taskLines.length

  if (batchCount === 0) warnings.push('未检测到 "## Batch N" 批次标题')
  if (taskCount === 0) warnings.push('未检测到 "- [ ] T-NN" 任务行')

  // 每个任务块（从 - [ ] T- 到下一个 - [ ] T- 或 ## Batch 或文件结尾）必须含 文件/前置/验收
  const blocks = md.split(/^- \[ \]\s*T-\d+/gm).slice(1)
  let missingFiles = 0
  let missingDeps = 0
  let missingAccept = 0
  for (const block of blocks) {
    const head = block.split(/^## Batch/m)[0]
    if (!/- 文件：/.test(head)) missingFiles++
    if (!/- 前置：/.test(head)) missingDeps++
    if (!/- 验收：/.test(head)) missingAccept++
  }
  if (missingFiles > 0) warnings.push(`${missingFiles} 个任务缺少「文件」要素`)
  if (missingDeps > 0) warnings.push(`${missingDeps} 个任务缺少「前置」要素`)
  if (missingAccept > 0) warnings.push(`${missingAccept} 个任务缺少「验收」要素`)

  return {
    ok: batchCount > 0 && taskCount > 0 && missingFiles === 0 && missingAccept === 0,
    batchCount,
    taskCount,
    warnings,
  }
}

/** 任务拆解 API 路由 */
export const Route = createFileRoute('/api/execute/taskPlanner')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { planContent, appDesc, instruction, modal } = body

        if (!modal?.name || !modal?.url) {
          return new Response(
            JSON.stringify({ status: 'error', error: '模型配置不完整' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        if (!planContent) {
          return new Response(
            JSON.stringify({ status: 'error', error: '缺少技术方案（plan）内容，请先连接「概设/二次分析」节点' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // 1. 读取 prompt 文件
        const promptPath = path.resolve(process.cwd(), 'prompts', 'taskPlanner.md')
        let basePrompt = ''
        try {
          basePrompt = fs.readFileSync(promptPath, 'utf-8')
        } catch {
          basePrompt = 'You are a task planner. Break the plan into batches of tasks.'
        }

        // 2. 组装 system prompt（基础 prompt + 自定义指令）
        const fullSystemPrompt = `${basePrompt}\n\n${
          instruction ? `# 本次拆解的额外指令\n${instruction}\n\n` : ''
        }# 输入内容\n\n## 技术方案（plan.md）\n${planContent.slice(0, 40000)}${
          appDesc ? `\n\n## 应用地图（App-Desc）\n${String(appDesc).slice(0, 10000)}` : ''
        }`

        // 3. 调用 AI
        let content: string
        try {
          const result = await callAI({
            model: {
              name: modal.name,
              key: modal.key,
              url: modal.url,
              token: modal.token,
            },
            systemPrompt: fullSystemPrompt,
            prompt: '请根据以上技术方案，按输出 schema 生成 tasks.md。',
            temperature: 0.2,
          })
          content = result.text.trim()
        } catch (err: any) {
          return new Response(
            JSON.stringify({ status: 'error', error: `AI 调用失败: ${err.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // 4. 去除模型可能包裹的代码块围栏
        content = content.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/, '')

        // 5. 结构化校验
        const validated = validateTasks(content)

        if (!validated.ok) {
          return new Response(
            JSON.stringify({
              status: 'error',
              error: `模型输出不符合 tasks.md schema：${validated.warnings.join('；')}`,
              warnings: validated.warnings,
            }),
            { status: 422, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            status: 'success',
            output: {
              tasksMarkdown: content,
              batchCount: validated.batchCount,
              taskCount: validated.taskCount,
              warnings: validated.warnings,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
