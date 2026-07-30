import type { NodeExecutor } from '#/types/engine'
import { userInputExecutor } from './userInput'
import { agentExecutor } from './agent'
import { bmadExecutor } from './bmad'
import { larkExecutor } from './lark'
import { answerExecutor } from './answer'
import { aiOutputExecutor } from './aiOutput'
import { ifExecutor, ifConditionExecutor } from './if'
import { loopExecutor, loopConditionExecutor } from './loop'
import { retryExecutor } from './retry'
import { codeAgentExecutor } from './codeAgent'
import { memoryExecutor } from './memory'
import { skillExecutor } from './skill'
import { larkTemplateExecutor } from './larkTemplate'
import { knowledgeRetrievalExecutor } from './knowledgeRetrieval'
import { knowledgeStoreExecutor } from './knowledgeStore'
import { larkWikiTraversalExecutor } from './larkWikiTraversal'
import { NodeTypes } from '#/types'

/** 节点类型 → 执行器映射 */
const executorMap: Record<string, NodeExecutor> = {
  [NodeTypes.USER_INPUT]: userInputExecutor,
  [NodeTypes.AGENT]: agentExecutor,
  [NodeTypes.BMAD_AGENT]: bmadExecutor,
  [NodeTypes.LARK]: larkExecutor,
  [NodeTypes.ANSWER]: answerExecutor,
  [NodeTypes.AI_OUTPUT]: aiOutputExecutor,
  [NodeTypes.IF]: ifExecutor,
  [NodeTypes.IF_CONDITION]: ifConditionExecutor,
  [NodeTypes.LOOP]: loopExecutor,
  [NodeTypes.LOOP_CONDITION]: loopConditionExecutor,
  [NodeTypes.RETRY]: retryExecutor,
  [NodeTypes.CODE_AGENT]: codeAgentExecutor,
  [NodeTypes.MEMORY]: memoryExecutor,
  [NodeTypes.SKILL]: skillExecutor,
  [NodeTypes.LARK_TEMPLATE]: larkTemplateExecutor,
  [NodeTypes.KNOWLEDGE_RETRIEVAL]: knowledgeRetrievalExecutor,
  [NodeTypes.KNOWLEDGE_STORE]: knowledgeStoreExecutor,
  [NodeTypes.LARK_WIKI_TRAVERSAL]: larkWikiTraversalExecutor,
}

/** 根据节点类型获取执行器 */
export function getExecutor(nodeType: string): NodeExecutor | undefined {
  return executorMap[nodeType]
}

/** 注册其他模块的执行器 */
export function registerExecutor(nodeType: string, executor: NodeExecutor): void {
  executorMap[nodeType] = executor
}

export {
  userInputExecutor,
  agentExecutor,
  larkTemplateExecutor,
  bmadExecutor,
  larkExecutor,
  answerExecutor,
  aiOutputExecutor,
  ifExecutor,
  ifConditionExecutor,
  loopExecutor,
  loopConditionExecutor,
  retryExecutor,
  codeAgentExecutor,
  memoryExecutor,
  skillExecutor,
  knowledgeRetrievalExecutor,
  knowledgeStoreExecutor,
  larkWikiTraversalExecutor,
}
