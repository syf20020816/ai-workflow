import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { buildBudgetedContext } from '#/services/upstreamContext'

/**
 * CodeAgent 节点执行器
 *
 * 调用 Vercel AI SDK 的 API（/api/execute/codeAgent），
 * 由 SDK 自动管理 Tool Calling 循环（工具调用 → 执行 → 回传 → 继续）。
 *
 * 两种模式（节点 data.mode）：
 * - analyze（默认）：只读探索分析，产出技术方案文档
 * - batch：按 tasks.md 批次实现代码（写文件工具 + 打勾进度 + diff 记录）
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
    const maxIterations = data.maxIterations ?? 20
    const useAppMap = data.useAppMap ?? true
    const modal = data.modal

    const logs: string[] = []
    logs.push(`CodeAgent 开始执行（模式: ${mode === 'batch' ? 'batch · 分批编码' : 'analyze · 代码分析'}）`)
    logs.push(`项目路径: ${projectPath || '未设置（请使用绝对路径）'}`)
    if (branch) logs.push(`Git 分支: ${branch}`)
    logs.push(`分析指令: ${instruction}`)
    logs.push(`最大迭代次数: ${maxIterations}`)

    if (!modal?.name || !modal?.url) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '模型配置不完整，请在编辑面板中为代码处理节点选择一个模型'],
        error: '模型配置不完整',
      }
    }

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
      const budgetedContext = buildBudgetedContext(input, modal.token?.max)

      const res = await fetch('/api/execute/codeAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          projectPath,
          branch,
          instruction,
          maxIterations,
          // 应用地图开关（默认开启：analyze 时检测/生成项目 App-Desc）
          useAppMap,
          modal: {
            name: modal.name,
            key: modal.key,
            url: modal.url,
            token: modal.token,
          },
          // batch 模式专用
          ...(mode === 'batch' ? { tasksMarkdown } : {}),
          // 传递上游节点（如 Agent 节点）的上下文（已裁剪）
          upstreamContext: budgetedContext,
        }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          // 保留中间输出（如截断时的部分分析结果），供执行结果页查看
          output: result.output || {},
          logs: [...logs, ...(result.logs || []), result.error],
          error: result.error,
        }
      }

      logs.push(...(result.logs || []))
      logs.push(`CodeAgent 执行完成`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response: result.output.response,
          model: modal.name,
          iterations: result.output.iterations,
          projectPath,
          // batch 模式额外输出（进度 / diff，供执行结果页与续跑使用）
          ...(mode === 'batch'
            ? {
                mode,
                completedBatches: result.output.completedBatches,
                totalBatches: result.output.totalBatches,
                tasksMarkdown: result.output.tasksMarkdown,
                diffRecords: result.output.diffRecords,
              }
            : {}),
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, `请求失败: ${err.message}`],
        error: `CodeAgent API 调用失败: ${err.message}`,
      }
    }
  },
}
