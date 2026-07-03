import type { Node, Edge } from '@xyflow/react'
import type {
  PipelineContext,
  NodeExecutionConfig,
  NodeExecutionContext,
  LogEntry,
} from '#/types/engine'
import { topologicalSort, getPredecessors } from './topological'
import { getExecutor } from './executors'

/** 从 node.data 中安全提取标题 */
function getNodeTitle(node: Node): string {
  const data = node.data
  return typeof data.title === 'string' ? data.title : ''
}

/** 创建初始 PipelineContext */
export function createPipelineContext(): PipelineContext {
  return {
    currentNodeId: null,
    nodeStatuses: {},
    nodeOutputs: {},
    logs: [],
    globalStatus: 'idle',
  }
}

/** 添加日志 */
function addLog(ctx: PipelineContext, nodeId: string, nodeTitle: string, level: LogEntry['level'], message: string): void {
  ctx.logs.push({
    timestamp: Date.now(),
    nodeId,
    nodeTitle,
    level,
    message,
  })
}

/**
 * 执行工作流
 * @param nodes - 所有节点
 * @param edges - 所有连线
 * @param onUpdate - 每执行完一个节点的回调（用于 UI 更新）
 * @param options - 可选参数
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  onUpdate: (ctx: PipelineContext) => void,
  options?: {
    startNodeId?: string
    userInputs?: Record<string, any>
  },
): Promise<PipelineContext> {
  const ctx = createPipelineContext()
  ctx.globalStatus = 'running'

  // 找出有连线参与的节点（DAG 中的节点），孤立节点不执行
  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  }

  // 如果指定了 startNodeId，需要确保它也包含在内（可能新节点还没连上线）
  if (options?.startNodeId) {
    connectedNodeIds.add(options.startNodeId)
  }

  // 如果没有连线但用户点了单节点执行，允许执行单个节点
  const dagNodes = connectedNodeIds.size > 0 || options?.startNodeId
    ? nodes.filter((n) => connectedNodeIds.has(n.id))
    : []

  if (dagNodes.length === 0 && !options?.startNodeId) {
    ctx.globalStatus = 'completed'
    addLog(ctx, '', '', 'warn', '没有需要执行的节点（请用连线连接节点后再运行）')
    onUpdate(ctx)
    return ctx
  }

  // 拓扑排序（只对 DAG 中的节点）
  const { sortedIds, cycles } = topologicalSort(dagNodes, edges)
  if (cycles.length > 0) {
    ctx.globalStatus = 'error'
    addLog(ctx, '', '', 'error', `检测到循环依赖: ${cycles.join(', ')}`)
    onUpdate(ctx)
    return ctx
  }

  // 如果指定了 startNodeId，只执行子图
  let executionOrder = sortedIds
  if (options?.startNodeId) {
    const startIndex = sortedIds.indexOf(options.startNodeId)
    if (startIndex >= 0) {
      executionOrder = sortedIds.slice(startIndex)
    }
  }

  // 初始化节点状态（只初始化 DAG 中的节点）
  for (const node of dagNodes) {
    ctx.nodeStatuses[node.id] = 'idle'
  }

  const nodeMap = new Map(dagNodes.map((n) => [n.id, n]))

  // 逐节点执行
  for (const nodeId of executionOrder) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    const nodeTitle = getNodeTitle(node)

    ctx.currentNodeId = nodeId
    ctx.nodeStatuses[nodeId] = 'running'
    addLog(ctx, nodeId, nodeTitle, 'info', `开始执行...`)
    onUpdate({ ...ctx })

    // 获取上游节点的 output 作为当前节点的 input
    const predecessors = getPredecessors(nodeId, edges)
    const input: Record<string, any> = {}
    for (const predId of predecessors) {
      const predOutput = ctx.nodeOutputs[predId]
      if (predOutput) {
        Object.assign(input, predOutput)
      }
    }

    // 构建执行上下文
    const execConfig: NodeExecutionConfig = {
      nodeId: node.id,
      nodeType: node.type || '',
      title: nodeTitle,
      data: node.data as Record<string, any>,
    }

    const execCtx: NodeExecutionContext = {
      config: execConfig,
      input,
      globalContext: {
        userInputs: options?.userInputs || {},
      },
    }

    // 获取执行器并执行
    const executor = getExecutor(node.type || '')
    if (!executor) {
      ctx.nodeStatuses[nodeId] = 'error'
      addLog(ctx, nodeId, nodeTitle, 'error', `未知节点类型: ${node.type}`)
      ctx.globalStatus = 'error'
      onUpdate({ ...ctx })
      break
    }

    const result = await executor.execute(execCtx)

    // 处理执行结果
    if (result.status === 'waiting') {
      ctx.nodeStatuses[nodeId] = 'waiting'
      ctx.globalStatus = 'paused'
      ctx.nodeOutputs[nodeId] = result.output
      addLog(ctx, nodeId, nodeTitle, 'warn', '等待用户输入...')
      onUpdate({ ...ctx })
      return ctx
    }

    if (result.status === 'error') {
      ctx.nodeStatuses[nodeId] = 'error'
      ctx.globalStatus = 'error'
      addLog(ctx, nodeId, nodeTitle, 'error', result.error || '执行失败')
      onUpdate({ ...ctx })
      break
    }

    // 成功
    ctx.nodeStatuses[nodeId] = 'success'
    ctx.nodeOutputs[nodeId] = result.output
    for (const logMsg of result.logs) {
      addLog(ctx, nodeId, nodeTitle, 'info', logMsg)
    }
    onUpdate({ ...ctx })
  }

  // 检查是否所有节点都完成了
  if (ctx.globalStatus === 'running') {
    ctx.globalStatus = 'completed'
    ctx.currentNodeId = null
    addLog(ctx, '', '', 'info', '工作流执行完成')
    onUpdate({ ...ctx })
  }

  return ctx
}

/**
 * 恢复执行（用于 Answer 节点用户输入后继续）
 */
export async function resumeWorkflow(
  nodeId: string,
  userInput: string,
  _pipelineCtx: PipelineContext,
  nodes: Node[],
  edges: Edge[],
  onUpdate: (ctx: PipelineContext) => void,
): Promise<PipelineContext> {
  const userInputs = { [nodeId]: userInput }

  return executeWorkflow(nodes, edges, onUpdate, {
    startNodeId: nodeId,
    userInputs,
  })
}
