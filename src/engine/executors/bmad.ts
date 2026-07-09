import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * BMad 角色节点执行器
 *
 * 接收上游 Agent 的输出，利用 BMad 角色定义(roleDescription/systemPrompt)
 * 和 BMad Method 方法论，对 Agent 的响应进行角色视角的分析和补充。
 *
 * 执行流程：
 * 1. 检查 BMad 安装状态
 * 2. 加载 BMad 技能列表作为上下文
 * 3. 根据角色配置调用 AI 进行 BMad Method 分析
 * 4. 返回结构化结果
 */
export const bmadExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const data = config.data

    const logs: string[] = []
    logs.push(`BMad 角色: ${data.role || config.title}`)

    const upstreamResponse =
      (input as any).response || (input as any).analysis || ''

    // Step 1: 检查 BMad 安装状态
    let bmadInstalled = false
    try {
      const statusRes = await fetch('/api/execute/bmad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      })
      const statusResult = await statusRes.json()
      bmadInstalled = statusResult.output?.installed === true
      logs.push(bmadInstalled ? 'BMad 已安装' : 'BMad 未安装')
    } catch {
      logs.push('BMad 状态检查失败')
    }

    // Step 2: 如果有 systemPrompt 和上游响应，调用 AI 进行 BMad Method 分析
    if (data.systemPrompt && upstreamResponse) {
      logs.push('使用 BMad Method 上下文进行角色分析...')

      try {
        // 优先使用 BMadNode 自身的模型配置，其次从全局上下文获取
        const modalConfig = (data as any).modal || (ctx.globalContext as any).modelConfig

        if (modalConfig?.url) {
          // 先加载技能列表作为上下文（如果 BMad 已安装）
          let skillsContext = ''
          if (bmadInstalled) {
            try {
              const skillsRes = await fetch('/api/execute/bmad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'skills' }),
              })
              const skillsResult = await skillsRes.json()
              if (skillsResult.status === 'success') {
                const skills = skillsResult.output.skills || []
                skillsContext = skills
                  .slice(0, 10)
                  .map(
                    (s: any) =>
                      `[${s.phase}] ${s.displayName}: ${s.description}`,
                  )
                  .join('\n')
                logs.push(`加载 ${skills.length} 个 BMad Skills 作为上下文`)
              }
            } catch {
              // 技能加载失败不影响主流程
            }
          }

          // 构建 BMad Method 增强的系统提示词
          const bmadEnhancedPrompt = bmadInstalled
            ? `你正在使用 BMad Method 方法论工作。BMad 是一套结构化的 AI 驱动开发方法论。\n\n当前 BMad 技能上下文:\n${skillsContext || '无可用技能'}\n\n${data.systemPrompt}`
            : data.systemPrompt

          // 调用 AI API 进行角色分析
          const res = await fetch('/api/execute/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modalConfig,
              messages: [
                {
                  role: 'user',
                  content: `请从以下角色视角分析上游的输出，遵循 BMad Method 方法论输出结构化结果:\n\n${upstreamResponse}`,
                },
              ],
              systemPrompt: bmadEnhancedPrompt,
              temperature: data.temperature ?? 0.3,
            }),
          })

          const result = await res.json()
          if (result.status === 'success') {
            logs.push('BMad 角色分析完成')

            return {
              nodeId: config.nodeId,
              status: 'success',
              output: {
                analysis: result.output.response,
                role: data.role,
                modal: data.modal,
                bmadMethod: true,
                bmadInstalled,
              },
              logs,
            }
          }

          logs.push('AI 分析无响应')
        } else {
          logs.push('未配置模型，使用纯文本注解')
        }
      } catch (err: any) {
        logs.push(`AI 分析失败: ${err.message}，回退到纯文本注解`)
      }
    }

    // Step 3: 纯文本注解（无 AI 调用或调用失败时的回退）
    const analysis = upstreamResponse
      ? `[${data.role || config.title} 视角 - BMad Method]\n${upstreamResponse.slice(0, 500)}`
      : `[${data.role || config.title}] 待上游数据`

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        analysis,
        role: data.role,
        modal: data.modal,
        systemPrompt: data.systemPrompt,
        bmadMethod: false,
        bmadInstalled,
      },
      logs,
    }
  },
}
