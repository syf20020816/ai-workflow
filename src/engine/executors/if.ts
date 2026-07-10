import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * ifNode 执行器
 * 接收上游输入，根据配置的表达式或条件分支来决定后续路径。
 * 
 * 执行逻辑：
 * 1. 接收上游输入
 * 2. 检查所有连出的 ifConditionNode 的 condition 配置
 * 3. 输出中包含 evaluatedConditions（各分支满足情况）
 * 4. ifConditionNode 根据此信息判断自己是否被选中
 */
export const ifExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const expression = config.data.expression || ''

    const logs: string[] = []
    logs.push(`判断节点: ${expression || '未设置表达式'}`)

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        ...input,
        _ifExpression: expression,
        _fromIfNode: true,
      },
      logs,
    }
  },
}

/**
 * ifConditionNode 执行器
 * 判断自身条件是否满足，若不满足则标记 _skipped: true
 */
export const ifConditionExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const condition = config.data.condition || ''
    const label = config.data.label || ''

    const logs: string[] = []
    logs.push(`条件分支: ${label || condition}`)

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        ...input,
        _condition: condition,
        _conditionLabel: label,
        _fromCondition: true,
      },
      logs,
    }
  },
}
