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

    // 构建实际使用的提示词（优先 systemPrompt，回退到 roleDescription）
    const effectivePrompt = data.systemPrompt || data.roleDescription || ''

    // Step 2: 如果有有效的提示词和上游响应，调用 AI 进行 BMad Method 分析
    if (effectivePrompt && upstreamResponse) {
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

          // 收集上游所有内容块（Skill节点指令、Lark模板等）
          const contentBlocks: string[] = []
          if ((input as any).instructions) {
            contentBlocks.push((input as any).instructions)
          }
          if ((input as any).templateContent) {
            contentBlocks.push(`【输出格式模板】\n${(input as any).templateContent}`)
          }
          const skipKeys = new Set([
            'text', 'prompt', 'response', 'analysis', 'result',
            'model', 'usage', 'role', 'modal',
            'bmadMethod', 'bmadInstalled',
            'error', 'status', 'output', 'logs',
            'skillName', 'skillId', 'templateUrl',
            'url', 'action', 'success',
            'fromCodeNode', 'codeStatus', 'codeMode',
            'codeFile', 'codeBranch', 'codeError',
          ])
          for (const [key, val] of Object.entries(input)) {
            if (typeof val === 'string' && val.length > 50 && !skipKeys.has(key)) {
              if (!contentBlocks.some((b) => val.startsWith(b.slice(0, 60)) || b.startsWith(val.slice(0, 60)))) {
                contentBlocks.push(val)
              }
            }
          }

          // 限制内容块总长度，防止超出模型上下文窗口
          const MAX_CONTENT_LENGTH = 6000
          let totalContentLength = 0
          const truncatedBlocks = contentBlocks.filter((b) => {
            totalContentLength += b.length
            if (totalContentLength > MAX_CONTENT_LENGTH) return false
            return true
          })
          if (truncatedBlocks.length < contentBlocks.length) {
            logs.push(`内容块过长已截断 (共 ${contentBlocks.length} 块，保留 ${truncatedBlocks.length} 块)`)
          }

          // 构建 BMad Method 增强的系统提示词
          let bmadEnhancedPrompt = bmadInstalled
            ? `你正在使用 BMad Method 方法论工作。BMad 是一套结构化的 AI 驱动开发方法论。\n\n当前 BMad 技能上下文:\n${skillsContext || '无可用技能'}\n\n${effectivePrompt}`
            : effectivePrompt

          // 分离模板内容和其他内容块，模板需要更强的格式约束
          const templateBlock = truncatedBlocks.find((b) => b.startsWith('【输出格式模板】'))
          const otherBlocks = truncatedBlocks.filter((b) => !b.startsWith('【输出格式模板】'))

          if (otherBlocks.length > 0) {
            const intro = otherBlocks.length === 1
              ? '\n\n以下是来自上游节点的参考内容：\n\n'
              : '\n\n以下是来自上游节点的多个参考内容：\n\n'
            bmadEnhancedPrompt = `${bmadEnhancedPrompt}${intro}${otherBlocks.join('\n\n---\n\n')}`
          }

          if (templateBlock) {
            // 模板需要强约束：必须输出模板结构
            bmadEnhancedPrompt = `${bmadEnhancedPrompt}\n\n【格式约束】请严格使用以下模板输出内容。你必须输出完整的模板结构（包括表格、标题），仅将模板中的空白占位符替换为实际信息，不要删除或改变模板的框架结构。如果模板中有空表格行，你可以按需填充内容行，但必须保留原表格列结构。\n\n${templateBlock}`
          }

          // 调用 AI API 进行角色分析
          const res = await fetch('/api/execute/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: {
                url: modalConfig.url,
                apiKey: modalConfig.key,
                modelName: modalConfig.name,
                token: modalConfig.token,
              },
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

            // 将上游的内容块透传到下游
            const passThrough: Record<string, string> = {}
            if ((input as any).templateContent) passThrough.templateContent = (input as any).templateContent
            if ((input as any).instructions) passThrough.instructions = (input as any).instructions

            return {
              nodeId: config.nodeId,
              status: 'success',
              output: {
                analysis: result.output.response,
                role: data.role,
                modal: data.modal,
                bmadMethod: true,
                bmadInstalled,
                ...passThrough,
              },
              logs,
            }
          }

          logs.push('AI 分析无响应')
        } else {
          logs.push('未配置模型，使用纯文本注解')
        }
      } catch (err: any) {
          logs.push(`AI 分析失败: ${err.message}${err.cause ? ` (${err.cause})` : ''}，回退到纯文本注解`)
          // 尝试记录响应详情
          if (err.response) {
            try {
              const detail = await err.response.text()
              logs.push(`API 响应详情: ${detail.slice(0, 200)}`)
            } catch {}
          }
        }
    }

    // Step 3: 纯文本注解（无 AI 调用或调用失败时的回退）
    const analysis = upstreamResponse
      ? `[${data.role || config.title} 视角 - BMad Method]\n${upstreamResponse}`
      : `[${data.role || config.title}] 待上游数据`

    // 将上游的内容块透传到下游
    const passThrough: Record<string, string> = {}
    if ((input as any).templateContent) passThrough.templateContent = (input as any).templateContent
    if ((input as any).instructions) passThrough.instructions = (input as any).instructions

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        analysis,
        role: data.role,
        modal: data.modal,
        systemPrompt: effectivePrompt,
        bmadMethod: false,
        bmadInstalled,
        ...passThrough,
      },
      logs,
    }
  },
}
