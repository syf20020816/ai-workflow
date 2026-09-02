import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { buildBudgetedContext } from '#/services/upstreamContext'
import { startAgentCli, pollAgentCliTask } from '#/services/runner'

/**
 * CodeAgent 节点执行器
 *
 * 由用户本机的 AI CLI（Claude Code / Codex / DeepSeek）直接在项目目录执行——
 * CLI 自身就是编码 agent（读写文件、跑命令、git），无需平台侧工具循环。
 *
 * 两种模式（节点 data.mode）：
 * - analyze（默认）：只读探索分析，产出技术方案文档（CLI 安全模式）
 * - batch：按 tasks.md 实现代码（auto 模式放开文件写入，CLI 自己打勾进度）
 *   tasks.md 来源优先级：上游 taskPlanner 节点 response > 平铺 input
 */
export const codeAgentExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data
    const mode = data.mode ?? 'analyze'
    const projectPath = data.projectPath || ''
    const branch = data.branch || ''
    const instruction = data.instruction || (mode === 'batch' ? '请按任务清单完成本批次代码实现' : '请分析这个项目的结构和功能')
    const localTool = data.tool

    const logs: string[] = []
    logs.push(`CodeAgent 开始执行（模式: ${mode === 'batch' ? 'batch · 分批编码' : 'analyze · 代码分析'}）`)
    logs.push(`项目路径: ${projectPath || '未设置（请使用绝对路径）'}`)
    if (branch) logs.push(`Git 分支: ${branch}`)
    logs.push(`执行指令: ${instruction}`)

    if (!localTool) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '未选择本地工具，请在编辑面板中选择'],
        error: '未选择本地工具',
      }
    }
    logs.push(`本地工具: ${localTool}`)

    // batch 模式：收集 tasks.md 输入
    let tasksMarkdown = ''
    if (mode === 'batch') {
      // 1a. 从上游祖先链找任务拆解（TASK_PLANNER）节点的 response
      const upstreams: any[] = (input as any).upstreams || []
      for (const up of upstreams) {
        if (
          (up.nodeType === 'taskPlanner' || up.nodeType === 'TASK_PLANNER') &&
          typeof up.response === 'string' &&
          up.response.trim().length > 0
        ) {
          tasksMarkdown = up.response
          logs.push(`已从上游「${up.title || '任务拆解'}」获取 tasks.md`)
          break
        }
      }

      // 1b. 平铺 input 兜底
      if (!tasksMarkdown) {
        const flat = (input as any).response || (input as any).content || (input as any).result || ''
        if (typeof flat === 'string' && flat.trim().length > 0) {
          tasksMarkdown = flat
          logs.push('已从平铺输入获取 tasks.md')
        }
      }

      if (!tasksMarkdown) {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: {},
          logs: [...logs, 'batch 模式未获取到 tasks.md：请连接「任务拆解」节点'],
          error: '缺少 tasks.md 输入',
        }
      }
    }

    try {
      // 上游上下文做「优先级排序 + 预算截断」，避免把未经裁剪的累积上下文整个透传（token 效率专项 P0-4）
      const budgetedContext = buildBudgetedContext(input, 64000)

      // 组装 prompt
      const parts: string[] = []
      if (branch) parts.push(`请先切换/确认当前 git 分支为 ${branch}。`)
      parts.push(
        mode === 'batch'
          ? `请按以下任务清单（tasks.md）在当前项目中实现代码。要求：\n- 完成一个任务后在 tasks.md 中把对应复选框打勾（- [x]）\n- 遵循项目现有代码风格\n- 完成后汇报本次改动摘要\n\n${tasksMarkdown}`
          : `请分析当前项目的结构与功能，产出一份技术方案文档（Markdown）：包含项目概览、模块划分、关键技术、可改进点。只读分析，不要修改任何文件。`,
      )
      if (instruction) parts.push(`附加指令：${instruction}`)
      const upstreamText = budgetedContext?.response || ''
      if (upstreamText.trim()) {
        parts.push(`上游节点上下文（需求/方案背景）：\n${upstreamText}`)
      }

      const taskId = await startAgentCli({
        tool: localTool,
        prompt: parts.join('\n\n'),
        // batch 模式需要写文件；analyze 只读用安全模式
        auto: mode === 'batch',
        cwd: projectPath || undefined,
        timeoutMs: 30 * 60_000,
      })
      logs.push(`任务已提交: ${taskId}`)

      const seenLogCount = { n: 0 }
      const task = await pollAgentCliTask(taskId, (t) => {
        const fresh = t.logs.slice(seenLogCount.n)
        if (fresh.length > 0) {
          logs.push(...fresh)
          seenLogCount.n = t.logs.length
        }
      })

      if (task.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: {},
          logs: [...logs, task.error || '本地工具执行失败'],
          error: task.error || '本地工具执行失败',
        }
      }

      logs.push(`CodeAgent 执行完成`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response: task.output?.response || '',
          model: task.toolName || localTool,
          projectPath,
          ...(mode === 'batch' ? { mode } : {}),
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, `请求失败: ${err.message}`],
        error: `CodeAgent 执行失败: ${err.message}`,
      }
    }
  },
}
