import type { Node, NodeProps } from '@xyflow/react'

export const NodeTypes = {
  USER_INPUT: 'userInput',
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

export type InputKind = (typeof InputKinds)[keyof typeof InputKinds];

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

export type AppNode = NodeProps<NUserInput> | null
