import type { Node, Edge } from '@xyflow/react'
import { NodeTypes } from '#/types'

/**
 * Kahn 算法拓扑排序。
 * 根据 edges 确定节点的执行顺序。
 * 返回按依赖关系排列的节点 ID 数组（无依赖的节点在前）。
 *
 * 特殊处理：
 * - loopNode + loopConditionNode：loop 回边会被特殊标记并处理
 * - 非 loop 边如果有循环则报错（正常流程禁止循环）
 */
export function topologicalSort(
  nodes: Node[],
  edges: Edge[],
  options?: { detectCycles?: boolean },
): { sortedIds: string[]; cycles: string[] } {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // 识别 loop 回边：从 loop body 节点回到 loopNode 的边
  const loopBackEdges = new Set<string>()
  const loopNodeIds = new Set(
    nodes.filter((n) => n.type === NodeTypes.LOOP).map((n) => n.id),
  )
  const loopConditionIds = new Set(
    nodes.filter((n) => n.type === NodeTypes.LOOP_CONDITION).map((n) => n.id),
  )

  // 找到从 loop body 回到 loopNode 或 loopConditionNode 的边
  for (const edge of edges) {
    if (loopNodeIds.has(edge.target)) {
      // 回到 loopNode 的是回边
      loopBackEdges.add(edge.id)
    }
    if (loopConditionIds.has(edge.target) && !loopNodeIds.has(edge.source)) {
      // 从 body 节点回到 loopConditionNode 也是回边
      loopBackEdges.add(edge.id)
    }
  }

  // 初始化
  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adjacency.set(id, [])
  }

  // 构建邻接表和入度（排除 loop 回边）
  for (const edge of edges) {
    const { source, target, id } = edge
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue

    if (options?.detectCycles !== false && loopBackEdges.has(id || '')) {
      // loop 回边不计入常规排序
      continue
    }

    adjacency.get(source)!.push(target)
    inDegree.set(target, (inDegree.get(target) || 0) + 1)
  }

  // BFS 拓扑排序
  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sortedIds: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    sortedIds.push(id)
    for (const neighbor of adjacency.get(id) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  // 检测环（入度未归零的节点）- 排除 loop 回边涉及的节点
  const cycles: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree > 0 && !loopNodeIds.has(id) && !loopConditionIds.has(id)) {
      cycles.push(id)
    }
  }

  return { sortedIds, cycles }
}

/**
 * 获取 DAG 的拓扑层（并行分组）。
 * 每一层的节点之间没有依赖关系，可以安全地并行执行。
 *
 * @returns 二维数组，每组内的节点可并行执行
 */
export function topologicalLayers(
  nodes: Node[],
  edges: Edge[],
): string[][] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adjacency.set(id, [])
  }

  for (const edge of edges) {
    const { source, target } = edge
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue
    adjacency.get(source)!.push(target)
    inDegree.set(target, (inDegree.get(target) || 0) + 1)
  }

  const layers: string[][] = []
  let currentLayer = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)

  while (currentLayer.length > 0) {
    layers.push([...currentLayer])

    const nextLayer: string[] = []
    for (const id of currentLayer) {
      for (const neighbor of adjacency.get(id) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          nextLayer.push(neighbor)
        }
      }
    }
    currentLayer = nextLayer
  }

  return layers
}

/** 获取以某个节点为起点的所有可达节点 ID */
export function getReachableNodeIds(
  startNodeId: string,
  edges: Edge[],
): Set<string> {
  const reachable = new Set<string>()
  const queue = [startNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const succ of getSuccessors(id, edges)) {
      queue.push(succ)
    }
  }
  return reachable
}

/** 获取节点的上游节点 ID（直接前驱） */
export function getPredecessors(nodeId: string, edges: Edge[]): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source)
}

/** 获取节点的下游节点 ID（直接后继） */
export function getSuccessors(nodeId: string, edges: Edge[]): string[] {
  return edges.filter((e) => e.source === nodeId).map((e) => e.target)
}

/** 获取工作流的起点（入度为 0 的节点） */
export function getEntryNodes(nodes: Node[], edges: Edge[]): string[] {
  const hasIncoming = new Set(edges.map((e) => e.target))
  return nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id)
}

/** 获取以某个节点为起点的子图拓扑顺序 */
export function getSubgraphOrder(
  startNodeId: string,
  nodes: Node[],
  edges: Edge[],
): string[] {
  const reachable = new Set<string>()
  const queue = [startNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (reachable.has(id)) continue
    reachable.add(id)
    for (const succ of getSuccessors(id, edges)) {
      queue.push(succ)
    }
  }

  const subNodes = nodes.filter((n) => reachable.has(n.id))
  const subEdges = edges.filter(
    (e) => reachable.has(e.source) && reachable.has(e.target),
  )
  // 对子图做拓扑排序
  const allNodes = topologicalSort(subNodes, subEdges)
  return allNodes.sortedIds
}

/**
 * 验证工作流是否包含非法循环（非 loopNode 引入的循环）
 * 返回所有形成非法循环的节点 ID
 */
export function detectIllegalCycles(
  nodes: Node[],
  edges: Edge[],
): string[] {
  const result = topologicalSort(nodes, edges, { detectCycles: true })
  return result.cycles
}
