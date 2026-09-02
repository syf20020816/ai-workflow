import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { startAgentCli, pollAgentCliTask } from '#/services/runner'

/**
 * 任务拆解节点执行器
 *
 * 把「概设 / 二次分析」节点产出的 plan（技术方案）拆解为可独立执行的 batch 任务清单。
 * - plan 内容获取：上游 ancestors 中概设节点的 response > 平铺 input 文本
 * - 由用户本机的 AI CLI 生成 tasks.md（系统提示词从 prompts/taskPlanner.md 加载）
 * - 产出完整 tasks.md 文本放 output.response / tasksMarkdown，供下游 codeAgent batch 模式消费
 */
export const taskPlannerExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data
    const localTool = data.tool
    const instruction = data.instruction || ''

    const logs: string[] = []
    logs.push('任务拆解节点开始执行')

    if (!localTool) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '未选择本地工具，请在编辑面板中选择'],
        error: '未选择本地工具',
      }
    }

    // 1. 获取 plan（技术方案）内容
    let planContent = ''

    // 1a. 从上游祖先链找概设节点的输出（response / tasksMarkdown / content）
    const upstreams: any[] = (input as any).upstreams || []
    for (const up of upstreams) {
      const text =
        (typeof up.response === 'string' ? up.response : '') ||
        (typeof up.content === 'string' ? up.content : '') ||
        (typeof up.result === 'string' ? up.result : '') ||
        ''
      if (text.trim().length > 0) {
        planContent = text
        logs.push(`已从上游「${up.title || up.nodeType}」获取技术方案`)
        break
      }
    }

    // 1b. 平铺 input 兜底
    if (!planContent) {
      planContent =
        (input as any).response ||
        (input as any).content ||
        (input as any).result ||
        (input as any).text ||
        (input as any).prompt ||
        ''
    }

    if (!planContent || String(planContent).trim().length === 0) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '未获取到技术方案（plan）内容，请先连接「概设/二次分析」节点'],
        error: '缺少技术方案（plan）输入',
      }
    }

    logs.push(`plan 内容长度: ${String(planContent).length} 字符`)

    // 2. 由本地 CLI 拆解
    try {
      // 加载系统提示词（支持「规则与模型」页面自定义）
      let basePrompt = `你是一个技术方案拆解专家。把给定的技术方案（plan）拆解为分批次（Batch）的 tasks.md 任务清单。要求：
- 使用 Markdown 复选框格式（- [ ]）组织任务
- 按 Batch 分节，每个 Batch 是一次可独立提交/评审的工作单元
- 每个任务必须有清晰的验收标准
- 不要写代码，只输出 tasks.md 内容`
      try {
        const res = await fetch('/api/prompts?name=taskPlanner.md')
        const pdata = await res.json()
        if (pdata.status === 'success' && pdata.data?.content) {
          basePrompt = pdata.data.content
        }
      } catch { /* 使用默认提示词 */ }

      const prompt = [
        basePrompt,
        instruction ? `拆解要求（追加指令）：\n${instruction}` : '',
        `以下是待拆解的技术方案（plan）：`,
        String(planContent),
        `请输出完整的 tasks.md 内容（Markdown 文本，不要额外解释）。`,
      ]
        .filter(Boolean)
        .join('\n\n')

      const taskId = await startAgentCli({ tool: localTool, prompt, timeoutMs: 15 * 60_000 })
      const seenLogCount = { n: 0 }
      const task = await pollAgentCliTask(taskId, (t) => {
        const fresh = t.logs.slice(seenLogCount.n)
        if (fresh.length > 0) {
          logs.push(...fresh)
          seenLogCount.n = t.logs.length
        }
      })
      if (task.status === 'error') {
        throw new Error(task.error || '本地工具执行失败')
      }

      const tasksMarkdown = task.output?.response || ''
      if (!tasksMarkdown.trim()) {
        throw new Error('本地工具未产出任务清单')
      }

      // 从生成的 tasks.md 中统计批次/任务数（宽松匹配）
      const batchCount = (tasksMarkdown.match(/#{1,3}\s*Batch\s*[-–—]?\s*\d+/gi) || []).length
      const taskCount = (tasksMarkdown.match(/^\s*[-*]\s*\[[ x]\]/gm) || []).length

      logs.push(`拆解完成：${batchCount || '(未匹配到标准分节)'} 个 Batch，${taskCount} 个任务`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          // 只保留 response 一份全文，tasks 内容由 extractAccumulated 按文本累积/写盘
          response: tasksMarkdown,
          batchCount,
          taskCount,
        },
        logs,
      }
    } catch (err: any) {
      logs.push(`任务拆解失败: ${err.message}`)
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs,
        error: `任务拆解失败: ${err.message}`,
      }
    }
  },
}
