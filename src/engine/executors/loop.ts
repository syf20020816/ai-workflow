import type { NodeExecutionContext, NodeExecutionResult, NodeExecutor } from '#/types/engine'

/**
 * loopNode 执行器
 * 管理循环迭代。
 * 
 * 执行逻辑：
 * 1. 检查当前是否在循环过程中（通过 globalContext）
 * 2. 如果是首次进入，初始化循环计数器
 * 3. 输出 currentLoopCount 给 loopConditionNode 判断
 * 
 * 注意：当前引擎基于 DAG 线性执行，真正的循环需要引擎支持重新执行子图。
 * 此执行器为循环提供基础数据和计数能力。
 */
export const loopExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input, globalContext } = ctx
    const maxLoopCount = config.data.maxLoopCount || 5
    const loopId = config.nodeId

    // 从全局上下文中获取或初始化循环状态
    const loopStates: Record<string, { current: number } | undefined> = globalContext._loopStates || {}
    const currentCount = loopStates[loopId]?.current ?? 0

    const logs: string[] = []
    logs.push(`循环节点: 第 ${currentCount + 1} 次 / 最大 ${maxLoopCount} 次`)

    const shouldContinue = currentCount < maxLoopCount

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        ...input,
        _loopId: loopId,
        _maxLoopCount: maxLoopCount,
        _currentLoopCount: currentCount,
        _shouldContinue: shouldContinue,
        _fromLoopNode: true,
      },
      logs,
    }
  },
}

/**
 * loopConditionNode 执行器
 * 评估循环条件，决定是否退出循环。
 * 
 * 执行逻辑：
 * 1. 接收 loopNode 的 currentLoopCount
 * 2. 如果 currentLoopCount >= maxLoopCount，标记 exit
 * 3. 如果条件表达式为空，仅靠次数控制
 */
export const loopConditionExecutor: NodeExecutor = {
  execute: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const { config, input } = ctx
    const condition = config.data.condition || ''
    const currentCount = (input as any)._currentLoopCount ?? 0
    const maxCount = (input as any)._maxLoopCount ?? 5
    const shouldContinue = (input as any)._shouldContinue ?? false

    const logs: string[] = []
    const shouldExit = !shouldContinue || currentCount >= maxCount

    if (shouldExit) {
      logs.push(`循环条件: 达到最大次数(${maxCount})，退出循环`)
    } else if (condition) {
      logs.push(`循环条件: ${condition}，继续循环 (${currentCount + 1}/${maxCount})`)
    } else {
      logs.push(`继续循环 (${currentCount + 1}/${maxCount})`)
    }

    return {
      nodeId: config.nodeId,
      status: 'success',
      output: {
        ...input,
        _loopExited: shouldExit,
        _loopCondition: condition,
        _fromLoopCondition: true,
      },
      logs,
    }
  },
}
