import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * SelfCheck 自检 Agent 节点执行器（P1-3）
 *
 * 核心原则：独立会话 · 独立上下文 —— 不继承上游编码 Agent 的记忆（防止确认偏差）。
 * 评审材料按可用性自动降级（详见 API collectMaterials）：
 *   1. Spec 产物（spec.md / plan.md / tasks.md）—— Spec 模式
 *   2. 项目 git diff —— 常规模式放在 codeAgent 之后的编码检测
 *   3. 上游累积产物 —— 常规模式接其他节点（AIAgent / 飞书文档等）的文档类场景
 */
export const selfCheckExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, globalContext, input } = ctx
    const data = config.data
    const modal = data.modal
    // Spec 产物目录（评审材料来源之一）
    const specRoot = globalContext.specRoot as string | undefined
    // 上游累积上下文（原始需求 / 最终交付物等，按场景作为兜底评审材料）
    const upstreams: any[] = (input as any).upstreams || []

    const logs: string[] = []
    logs.push(`SelfCheck 自检 Agent 开始执行（独立会话评审）`)
    logs.push(`项目路径: ${data.projectPath || '未设置（依赖 Spec 产物/上游）'}`)
    logs.push(`Spec 产物目录: ${specRoot || '无'}`)
    logs.push(`上游节点数: ${upstreams.length}`)
    logs.push(`评审视角角色: ${data.role || '默认（无角色）'}`)

    if (!modal?.name || !modal?.url) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, '模型配置不完整，请在编辑面板中选择模型'],
        error: '模型配置不完整',
      }
    }

    try {
      const res = await fetch('/api/execute/selfCheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modal: {
            name: modal.name,
            key: modal.key,
            url: modal.url,
            token: modal.token,
          },
          specRoot: specRoot || undefined,
          projectPath: data.projectPath || '',
          instruction: data.instruction || '',
          role: data.role,
          roleDesc: data.roleDesc,
          upstreams,
        }),
      })

      const result = await res.json()

      if (result.status === 'error') {
        return {
          nodeId: config.nodeId,
          status: 'error',
          output: result.output || {},
          logs: [...logs, ...(result.logs || []), result.error],
          error: result.error,
        }
      }

      logs.push(...(result.logs || []))
      logs.push(`SelfCheck 自检完成，overall: ${result.output.overallResult}`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          response: result.output.response,
          overallResult: result.output.overallResult,
          checkDir: result.output.checkDir,
          model: modal.name,
        },
        logs,
      }
    } catch (err: any) {
      return {
        nodeId: config.nodeId,
        status: 'error',
        output: {},
        logs: [...logs, `请求失败: ${err.message}`],
        error: `SelfCheck API 调用失败: ${err.message}`,
      }
    }
  },
}
