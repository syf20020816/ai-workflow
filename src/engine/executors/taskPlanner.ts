import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { readSpecArtifact } from '#/services/specFolder'

/**
 * 任务拆解节点执行器
 *
 * 把「概设 / 二次分析」节点产出的 plan（技术方案）拆解为可独立执行的 batch 任务清单。
 * - plan 内容获取优先级：Spec 目录 plan.md（最准确）> 上游 ancestors 中概设节点的 response > 平铺 input 文本
 * - 调用 /api/execute/taskPlanner（服务端读 prompt + 调 LLM + 结构化校验）
 * - 产出完整 tasks.md 文本放 output.response / tasksMarkdown；引擎在 Spec 模式下
 *   会把该节点标记为 tasks 阶段产物的输出写入 spec 目录 tasks.md
 */
export const taskPlannerExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input, globalContext } = ctx
    const data = config.data
    const modal = data.modal
    const instruction = data.instruction || ''

    const logs: string[] = []
    logs.push('任务拆解节点开始执行')

    if (!modal?.name || !modal?.url) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '未配置模型，请在编辑面板中选择模型'],
        error: '未选择模型',
      }
    }

    // 1. 获取 plan（技术方案）内容
    const specRoot: string | undefined = globalContext.specRoot as string | undefined
    let planContent = ''

    // 1a. 优先读 Spec 目录 plan.md（上游已把 plan 落盘时的最准确来源）
    if (specRoot) {
      const fromSpec = await readSpecArtifact(specRoot, 'plan.md')
      if (fromSpec) {
        planContent = fromSpec
        logs.push('已从 Spec 目录读取 plan.md')
      }
    }

    // 1b. 从上游祖先链找概设节点的输出（response / tasksMarkdown / content）
    if (!planContent) {
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
    }

    // 1c. 平铺 input 兜底
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

    // 2. 调用服务端拆解
    try {
      const res = await fetch('/api/execute/taskPlanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planContent: String(planContent),
          appDesc: undefined,
          instruction,
          modal,
          nodeId: config.nodeId,
        }),
      })

      const result = await res.json()

      if (result.status !== 'success') {
        throw new Error(result.error || '任务拆解失败')
      }

      const { tasksMarkdown, batchCount, taskCount, warnings } = result.output || {}
      logs.push(`拆解完成：${batchCount} 个 Batch，${taskCount} 个任务`)
      if (warnings && warnings.length > 0) {
        logs.push(`校验提示：${warnings.join('；')}`)
      }

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          tasksMarkdown,
          response: tasksMarkdown,
          batchCount,
          taskCount,
          warnings,
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
