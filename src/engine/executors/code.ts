import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

export const codeExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const mode: 'local' | 'cloud' = config.data.mode || 'local'
    const filePath: string = config.data.repoUrl || ''
    const branch: string = config.data.branch || 'master'
    const lines: { start: number; end: number }[] = config.data.lines || []

    const logs: string[] = []

    if (!filePath) {
      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          ...input,
          _codeError: '未配置文件路径',
          _fromCodeNode: true,
        },
        logs: ['代码节点: 未配置文件路径，跳过代码分析'],
      }
    }

    logs.push(`代码节点: ${mode === 'local' ? '本地' : '云端'}模式`)
    logs.push(`文件: ${filePath} (分支: ${branch})`)

    try {
      const res = await fetch('/api/execute/code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          filePath,
          branch,
          lines,
          input,
        }),
      })

      const result = await res.json()

      return {
        nodeId: config.nodeId,
        status: result.status === 'success' ? 'success' : 'error',
        output: result.output,
        logs: [...logs, ...(result.logs || [])],
      }
    } catch (err: any) {
      logs.push(`调用后端 API 失败: ${err.message}`)

      return {
        nodeId: config.nodeId,
        status: 'success',
        output: {
          ...input,
          _codeMode: mode,
          _codeFile: filePath,
          _codeBranch: branch,
          _codeError: `调用后端 API 失败: ${err.message}`,
          _fromCodeNode: true,
          _codeStatus: 'error',
        },
        logs,
      }
    }
  },
}
