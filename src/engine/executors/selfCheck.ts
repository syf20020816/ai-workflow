import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'
import { startAgentCli, pollAgentCliTask } from '#/services/runner'

/**
 * SelfCheck 自检 Agent 节点执行器（P1-3）
 *
 * 核心原则：独立会话 · 独立上下文 —— 不继承上游编码 Agent 的记忆（防止确认偏差）。
 * 由用户本机的 AI CLI（独立进程 = 独立会话）执行评审：
 *   1. 项目 git diff —— 设置了 projectPath 时 CLI 直接在项目里读（ground truth）
 *   2. 上游累积产物 —— 接其他节点（AIAgent / 飞书文档等）的文档类场景
 */
export const selfCheckExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data
    const localTool = data.tool
    // 上游累积上下文（原始需求 / 最终交付物等，按场景作为兜底评审材料）
    const upstreams: any[] = (input as any).upstreams || []

    const logs: string[] = []
    logs.push(`SelfCheck 自检 Agent 开始执行（独立会话评审）`)
    logs.push(`项目路径: ${data.projectPath || '未设置（依赖上游产物）'}`)
    logs.push(`上游节点数: ${upstreams.length}`)
    logs.push(`评审视角角色: ${data.role || '默认（无角色）'}`)

    if (!localTool) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '未选择本地工具，请在编辑面板中选择'],
        error: '未选择本地工具',
      }
    }

    try {
      // 组装评审材料：角色视角 + 上游产物 + 指令
      // （设置了 projectPath 时由 Runner 预先收集 git diff 附进 prompt，CLI 安全模式即可评审）
      const parts: string[] = []
      if (data.role) {
        parts.push(`你是一名独立评审员，评审视角：${data.role}。`)
        if (data.roleDesc) parts.push(`视角说明：\n${data.roleDesc}`)
      } else {
        parts.push('你是一名独立评审员，请对以下交付物做独立评审（不参考任何执行者自己的评价）。')
      }
      if (data.projectPath) {
        parts.push(`评审对象为当前项目目录中的实际改动（git diff 已附在上方），请基于真实 diff 评审。`)
      }
      const upstreamMaterials = upstreams
        .map((up, i) => {
          const text =
            (typeof up.response === 'string' ? up.response : '') ||
            (typeof up.content === 'string' ? up.content : '') ||
            (typeof up.result === 'string' ? up.result : '') ||
            ''
          return text.trim() ? `【上游材料 ${i + 1}：${up.title || up.nodeType || '上游'}】\n${text}` : ''
        })
        .filter(Boolean)
      if (upstreamMaterials.length > 0) {
        parts.push(`上游累积产物（评审材料）：\n\n${upstreamMaterials.join('\n\n')}`)
      } else if (!data.projectPath) {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: {},
          logs: [...logs, '无评审材料：未设置项目路径且上游无产物'],
          error: '无评审材料',
        }
      }
      if (data.instruction) {
        parts.push(`本次评审关注点（追加指令）：${data.instruction}`)
      }
      parts.push(`请输出评审报告：先给出总体结论（PASS / FAIL / NEEDS_ATTENTION），再逐条列出问题与改进建议。`)

      const prompt = parts.join('\n\n')

      const taskId = await startAgentCli({
        tool: localTool,
        prompt,
        cwd: data.projectPath || undefined,
        gitDiff: !!data.projectPath,
        timeoutMs: 15 * 60_000,
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

      const response = task.output?.response || ''
      // 从评审报告中提取总体结论（宽松匹配首行结论）
      const overallMatch = response.match(/\b(PASS|FAIL|NEEDS_ATTENTION)\b/)
      const overallResult = overallMatch ? overallMatch[1] : 'UNKNOWN'

      logs.push(`SelfCheck 自检完成，overall: ${overallResult}`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response,
          overallResult,
          model: task.toolName || localTool,
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, `请求失败: ${err.message}`],
        error: `SelfCheck 执行失败: ${err.message}`,
      }
    }
  },
}
