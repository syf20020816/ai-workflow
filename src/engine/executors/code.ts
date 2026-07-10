import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * codeNode 执行器
 * 访问和分析用户代码。
 * 
 * 执行逻辑：
 * 1. 获取上游 AgentNode 或 BMadNode 的输出（分析请求）
 * 2. 读取配置的 repoUrl 和 branch
 * 3. 本地模式：读取本地文件
 * 4. 云端模式：调用外部 API 或 CLI 获取代码
 * 5. 将代码上下文和分析结果传递给下游
 * 
 * 注意：当前实现为基础设施阶段，真正的代码拉取/分析需要在后续
 * 版本中通过 CLI 或文件系统操作来增强。
 */
export const codeExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const mode: 'local' | 'cloud' = config.data.mode || 'local'
    const repoUrl: string = config.data.repoUrl || ''
    const branch: string = config.data.branch || 'master'

    const logs: string[] = []

    if (!repoUrl) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          ...input,
          _codeError: '未配置仓库 URL',
          _fromCodeNode: true,
        },
        logs: ['代码节点: 未配置仓库 URL，跳过代码分析'],
      }
    }

    logs.push(`代码节点: ${mode === 'local' ? '本地' : '云端'}模式`)
    logs.push(`仓库: ${repoUrl} (分支: ${branch})`)

    // 从上下文获取上游的意图（Agent/BMad 发起的分析请求）
    const upstreamResponse = (input as any).response || (input as any).analysis || ''
    logs.push(`等待实现代码分析功能: 需要实现 ${mode} 模式的代码拉取和分析`)

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        ...input,
        _codeMode: mode,
        _codeRepo: repoUrl,
        _codeBranch: branch,
        _codeRequest: upstreamResponse,
        _fromCodeNode: true,
        _codeStatus: 'configured',
      },
      logs,
    }
  },
}
