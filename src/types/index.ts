import type { Node, NodeProps } from '@xyflow/react'

export const NodeTypes = {
  USER_INPUT: 'userInput',
  AGENT: 'agent',
  AI_OUTPUT: 'aiOutput',
  ANSWER: 'answer',
  BMAD_AGENT: 'bmadAgent',
  LARK: 'lark',
  IF: 'if',
  IF_CONDITION: 'ifCondition',
  LOOP: 'loop',
  LOOP_CONDITION: 'loopCondition',
  RETRY: 'retry',
  CODE_AGENT: 'codeAgent',
  SKILL: 'skill',
  LARK_TEMPLATE: 'larkTemplate',
  MEMORY: 'memory',
  KNOWLEDGE_RETRIEVAL: 'knowledgeRetrieval',
} as const

export type NodeType = (typeof NodeTypes)[keyof typeof NodeTypes]

export type NNode = {
  /** 节点名称 */
  title: string
  /** 节点描述 */
  description?: string
}

export const InputKinds = {
  text: 'text',
  file: 'file',
  url: 'url',
  prompt: 'prompt',
}

export type InputKind = (typeof InputKinds)[keyof typeof InputKinds]

export type NUserInputData = {
  input?: {
    /** 文字输入的内容 */
    label?: string
    /** 提示词 */
    prompt?: string
    /** 上传的文件 */
    files?: File[]
    /** URL 链接 */
    urls?: string[]
  }
} & NNode

export type NUserInput = Node<NUserInputData, typeof NodeTypes.USER_INPUT>

export type NAgentData = NNode & {
  modal?: {
    /** 智能体名称(模型ID) */
    name?: string
    /** 智能体密钥 */
    key?: string
    /** 智能体别名 */
    alias?: string
    /** URL连接点 */
    url?: string
    /** Token范围 */
    token?: {
      min: number
      max: number
    }
  }
  input?: Pick<NUserInputData, 'input'>
  /** 输出结果 */
  output?: string
}

export type NAgent = Node<NAgentData, typeof NodeTypes.AGENT>

export type NAIOutputData = NNode & {
  /** 输出内容 */
  content?: string
  /** 来源智能体 */
  sourceAgent?: string
  /** 导出文件路径 */
  outputPath?: string
}

export type NAIOutput = Node<NAIOutputData, typeof NodeTypes.AI_OUTPUT>

/** Answer节点：在智能体执行过程中暂停等待用户输入 */
export type NAnswerData = NNode & {
  /** 向用户提出的问题/说明 */
  question?: string
  /** 用户回复内容 */
  reply?: string
  /** 回复选项（如果限定选择） */
  options?: string[]
}

export type NAnswer = Node<NAnswerData, typeof NodeTypes.ANSWER>

/** BMad子节点：为智能体节点提供角色指令（如 Skill） */
export type NBMadAgentData = NNode & {
  /** 智能体角色 */
  role?: string
  /** 角色描述/职责说明 */
  roleDescription?: string
  /** BMad Agent ID (如 bmad-agent-analyst) */
  agentId?: string
  /** 系统提示词 */
  systemPrompt?: string
}

export type NBMadAgent = Node<NBMadAgentData, typeof NodeTypes.BMAD_AGENT>

/** Lark节点：与Lark CLI交互 */
export type NLarkData = NNode & {
  /** 操作类型 */
  action?: 'read' | 'write' | 'create'
  /** 飞书文档URL/Token */
  url?: string
  /** 写入/创建的内容 */
  content?: string
  /** 操作结果 */
  result?: string
}

export type NLark = Node<NLarkData, typeof NodeTypes.LARK>

// ======== 控制节点 ========

/** ifNode：判断节点，根据条件选择不同分支 */
export type NIfData = NNode & {
  /** 判断表达式（描述性文本） */
  expression?: string
}

export type NIf = Node<NIfData, typeof NodeTypes.IF>

/** ifConditionNode：if 分支条件节点 */
export type NIfConditionData = NNode & {
  /** 条件表达式/描述 */
  condition?: string
  /** 分支描述，如 "条件A", "条件B" */
  label?: string
}

export type NIfCondition = Node<NIfConditionData, typeof NodeTypes.IF_CONDITION>

/** loopNode：循环节点 */
export type NLoopData = NNode & {
  /** 最大循环次数，默认 5 */
  maxLoopCount: number
  /** 当前循环次数（运行时） */
  currentLoopCount?: number
  /** 循环条件描述 */
  condition?: string
}

export type NLoop = Node<NLoopData, typeof NodeTypes.LOOP>

/** loopConditionNode：循环条件判断节点 */
export type NLoopConditionData = NNode & {
  /** 循环条件表达式 */
  condition?: string
}

export type NLoopCondition = Node<NLoopConditionData, typeof NodeTypes.LOOP_CONDITION>

/** retryNode：错误重试节点 */
export type NRetryData = NNode & {
  /** 重试间隔（秒），默认 1 */
  retryDelay: number
  /** 最大重试次数，默认 5 */
  maxRetryCount: number
  /** 判断模式：manual | ai */
  judgmentMode: 'manual' | 'ai'
  /** 人工判断：用于匹配错误状态的关键词/标识 */
  errorKeywords?: string
  /** AI 判断：连接的 AgentNode ID */
  agentNodeId?: string
}

export type NRetry = Node<NRetryData, typeof NodeTypes.RETRY>

/** codeAgentNode：代码自主探索节点 — AI 通过 Tool Calling 自主分析项目 */
export type NCodeAgentData = NNode & {
  /** 项目路径（本地目录或 Git 仓库 URL） */
  projectPath?: string
  /** Git 分支 */
  branch?: string
  /** AI 分析目标/指令 */
  instruction?: string
  /** 最大迭代次数（防止死循环） */
  maxIterations?: number
  /** 模型配置 */
  modal?: {
    name?: string
    key?: string
    url?: string
    token?: { min: number; max: number }
  }
}

export type NCodeAgent = Node<NCodeAgentData, typeof NodeTypes.CODE_AGENT>

/** Skill节点：加载技能指令并传递到下游 */
export type NSkillData = NNode & {
  /** 关联的技能ID */
  skillId?: string
  /** 技能名称（展示用） */
  skillName?: string
  /** 技能指令内容（执行时加载） */
  instructions?: string
}

export type NSkill = Node<NSkillData, typeof NodeTypes.SKILL>

/** Memory节点：读取记忆文件并传递到下游工作流 */
export type NMemoryData = NNode & {
  /** 记忆文件路径（相对于项目根目录） */
  memoryPath?: string
}

export type NMemory = Node<NMemoryData, typeof NodeTypes.MEMORY>

/** LarkTemplate节点：获取 Lark 文档作为输出模板 */
export type NLarkTemplateData = NNode & {
  /** Lark 文档 URL */
  templateUrl?: string
  /** 模板内容（执行时获取） */
  templateContent?: string
}

export type NLarkTemplate = Node<NLarkTemplateData, typeof NodeTypes.LARK_TEMPLATE>

/** 知识库检索节点：从 Qdrant 向量数据库进行语义搜索 */
export type NKnowledgeRetrievalData = NNode & {
  /** Qdrant 集合名称 */
  collectionName?: string
  /** 搜索查询文本 */
  query?: string
  /** 返回结果数量，默认 5 */
  topK?: number
  /** 最低相似度分数，默认 0 */
  scoreThreshold?: number
  /** 嵌入向量维度（用于创建集合时指定），默认 1536 */
  vectorSize?: number
  /** 搜索结果 */
  results?: Array<{
    id: string | number
    score: number
    payload?: Record<string, any>
  }>
}

export type NKnowledgeRetrieval = Node<NKnowledgeRetrievalData, typeof NodeTypes.KNOWLEDGE_RETRIEVAL>

export type AppNode = NodeProps<
  | NUserInput | NAgent | NAIOutput | NAnswer | NBMadAgent | NLark
  | NIf | NIfCondition | NLoop | NLoopCondition | NRetry | NCodeAgent
  | NSkill | NLarkTemplate | NMemory | NKnowledgeRetrieval
> | null
