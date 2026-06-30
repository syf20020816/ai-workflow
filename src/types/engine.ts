import type { Node, Edge } from '@xyflow/react'

/** 节点执行状态 */
export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'waiting'

/** 管线数据模型：上游 output → 下游 input */
export interface PipelineContext {
  /** 当前正在执行的节点 ID */
  currentNodeId: string | null
  /** 节点执行状态映射 */
  nodeStatuses: Partial<Record<string, NodeStatus>>
  /** 每个节点的输出结果 */
  nodeOutputs: Partial<Record<string, Record<string, any>>>
  /** 执行日志 */
  logs: LogEntry[]
  /** 全局运行状态 */
  globalStatus: 'idle' | 'running' | 'paused' | 'completed' | 'error'
}

/** 日志条目 */
export interface LogEntry {
  timestamp: number
  nodeId: string
  nodeTitle: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

/** 节点执行配置（从节点 data 中提取的标准化配置） */
export interface NodeExecutionConfig {
  nodeId: string
  nodeType: string
  title: string
  data: Record<string, any>
}

/** 节点执行上下文 */
export interface NodeExecutionContext {
  /** 该节点配置 */
  config: NodeExecutionConfig
  /** 来自上游节点的管线输入 */
  input: Record<string, any>
  /** 全局上下文（少量共享数据） */
  globalContext: Record<string, any>
}

/** 节点执行结果 */
export interface NodeExecutionResult {
  nodeId: string
  status: 'success' | 'error' | 'waiting'
  output: Record<string, any>
  logs: string[]
  error?: string
}

/** 执行器接口：每个节点类型必须实现 */
export interface NodeExecutor {
  /** 执行节点逻辑，返回 output */
  execute: (ctx: NodeExecutionContext) => Promise<NodeExecutionResult>
}

/** 工作流执行请求 */
export interface WorkflowRunRequest {
  nodes: Node[]
  edges: Edge[]
  startNodeId?: string // 为空则从起点执行
  userInputs?: Record<string, any> // 用户输入（用于 Answer 节点）
}
