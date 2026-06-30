import type { NodeExecutor } from '#/types/engine'
import { userInputExecutor } from './userInput'
import { agentExecutor } from './agent'
import { bmadExecutor } from './bmad'
import { larkExecutor } from './lark'
import { answerExecutor } from './answer'
import { aiOutputExecutor } from './aiOutput'
import { NodeTypes } from '#/types'

/** 节点类型 → 执行器映射 */
const executorMap: Record<string, NodeExecutor> = {
  [NodeTypes.USER_INPUT]: userInputExecutor,
  [NodeTypes.AGENT]: agentExecutor,
  [NodeTypes.BMAD_AGENT]: bmadExecutor,
  [NodeTypes.LARK]: larkExecutor,
  [NodeTypes.ANSWER]: answerExecutor,
  [NodeTypes.AI_OUTPUT]: aiOutputExecutor,
}

/** 根据节点类型获取执行器 */
export function getExecutor(nodeType: string): NodeExecutor | undefined {
  return executorMap[nodeType]
}

/** 注册其他模块的执行器 */
export function registerExecutor(nodeType: string, executor: NodeExecutor): void {
  executorMap[nodeType] = executor
}

export { userInputExecutor, agentExecutor, bmadExecutor, larkExecutor, answerExecutor, aiOutputExecutor }
