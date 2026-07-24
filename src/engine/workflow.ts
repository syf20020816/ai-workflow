import type { Node, Edge } from '@xyflow/react'
import type {
  PipelineContext,
  NodeExecutionConfig,
  NodeExecutionContext,
  NodeExecutionResult,
  LogEntry,
} from '#/types/engine'
import { topologicalLayers, getPredecessors, getReachableNodeIds } from './topological'
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
    /** 固定节点输出：{ [nodeId]: output }，注入后下游可直接拿到该输出 */
    nodeOutputOverrides?: Record<string, Record<string, any>>
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

  // 计算拓扑层（并行分组）
  let layers: string[][]
  if (options?.startNodeId) {
    const reachable = getReachableNodeIds(options.startNodeId, edges)
    const subNodes = dagNodes.filter((n) => reachable.has(n.id))
    const subEdges = edges.filter(
      (e) => reachable.has(e.source) && reachable.has(e.target),
    )
    layers = topologicalLayers(subNodes, subEdges)
  } else {
    layers = topologicalLayers(dagNodes, edges)
  }

  // 检测循环依赖：所有节点都应出现在层中
  const allLayered = new Set(layers.flat())
  const missing = dagNodes.filter((n) => !allLayered.has(n.id)).map((n) => n.id)
  if (missing.length > 0) {
    ctx.globalStatus = 'error'
    addLog(ctx, '', '', 'error', `检测到循环依赖: ${missing.join(', ')}`)
    onUpdate(ctx)
    return ctx
  }

  // 初始化节点状态（只初始化 DAG 中的节点）
  for (const node of dagNodes) {
    ctx.nodeStatuses[node.id] = 'idle'
  }

  const nodeMap = new Map(dagNodes.map((n) => [n.id, n]))

  // 注入固定节点输出（PIN 节点），使下游可以直接获取
  if (options?.nodeOutputOverrides) {
    for (const [nodeId, output] of Object.entries(options.nodeOutputOverrides)) {
      ctx.nodeOutputs[nodeId] = output
      ctx.nodeStatuses[nodeId] = 'success'
      addLog(ctx, nodeId, nodeMap.get(nodeId) ? getNodeTitle(nodeMap.get(nodeId)!) : '', 'info', '使用固定节点输出（PIN）')
    }
  }

  // 按层并行执行
  let hasWaiting = false
  loop: for (const layer of layers) {
    // 过滤掉已通过 PIN 注入的节点
    const activeIds = options?.nodeOutputOverrides
      ? layer.filter((id) => !(id in options.nodeOutputOverrides!))
      : layer

    if (activeIds.length === 0) continue

    // 并行执行当前层的所有节点
    const results = await Promise.all(
      activeIds.map(async (nodeId): Promise<{ nodeId: string; title?: string; status: 'skipped' | 'success' | 'error' | 'waiting'; result?: NodeExecutionResult; error?: string }> => {
        const node = nodeMap.get(nodeId)
        if (!node) return { nodeId, status: 'skipped' as const }

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
          return { nodeId, title: nodeTitle, status: 'error' as const, error: `未知节点类型: ${node.type}` }
        }

        const result = await executor.execute(execCtx)
        return { nodeId, title: nodeTitle, status: result.status, result }
      }),
    )

    // 汇总当前层的结果
    let layerHasError = false
    for (const r of results) {
      if (r.status === 'skipped') continue
      const nodeTitle = r.title || ''

      if (r.status === 'error') {
        ctx.nodeStatuses[r.nodeId] = 'error'
        ctx.globalStatus = 'error'
        addLog(ctx, r.nodeId, nodeTitle, 'error', r.error || '执行失败')
        layerHasError = true
      } else if (r.status === 'waiting' && r.result) {
        ctx.nodeStatuses[r.nodeId] = 'waiting'
        ctx.globalStatus = 'paused'
        ctx.nodeOutputs[r.nodeId] = r.result.output
        addLog(ctx, r.nodeId, nodeTitle, 'warn', '等待用户输入...')
        hasWaiting = true
      } else if (r.result) {
        ctx.nodeStatuses[r.nodeId] = 'success'
        ctx.nodeOutputs[r.nodeId] = r.result.output
        for (const logMsg of r.result.logs) {
          addLog(ctx, r.nodeId, nodeTitle, 'info', logMsg)
        }
      }
      onUpdate({ ...ctx })
    }

    if (layerHasError) break loop
    if (hasWaiting) return ctx
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
