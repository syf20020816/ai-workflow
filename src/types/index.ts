import type { Node, NodeProps } from '@xyflow/react'

export const NodeTypes = {
  USER_INPUT: 'userInput',
  AGENT: 'agent',
  AI_OUTPUT: 'aiOutput',
  ANSWER: 'answer',
  BMAD_AGENT: 'bmadAgent',
  LARK: 'lark',
}

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

/** BMad子节点：赋予智能体角色配置 */
export type NBMadAgentData = NNode & {
  /** 智能体角色 */
  role?: string
  /** 角色描述/职责说明 */
  roleDescription?: string
  /** 使用的模型 */
  model?: string
  /** 温度参数 */
  temperature?: number
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

export type AppNode = NodeProps<
  NUserInput | NAgent | NAIOutput | NAnswer | NBMadAgent | NLark
> | null
