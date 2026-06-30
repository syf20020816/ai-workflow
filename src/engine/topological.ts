import type { Node, Edge } from '@xyflow/react'

/**
 * Kahn 算法拓扑排序。
 * 根据 edges 确定节点的执行顺序。
 * 返回按依赖关系排列的节点 ID 数组（无依赖的节点在前）。
 */
export function topologicalSort(
  nodes: Node[],
  edges: Edge[],
): { sortedIds: string[]; cycles: string[] } {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // 初始化
  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adjacency.set(id, [])
  }

  // 构建邻接表和入度
  for (const edge of edges) {
    const { source, target } = edge
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue
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

  // 检测环（入度未归零的节点）
  const cycles: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree > 0) cycles.push(id)
  }

  return { sortedIds, cycles }
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
  const subEdges = edges.filter((e) => reachable.has(e.source) && reachable.has(e.target))
  // 对子图做拓扑排序
  const allNodes = topologicalSort(subNodes, subEdges)
  return allNodes.sortedIds
}
