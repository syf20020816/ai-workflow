import type { Model } from '#/types/model'

/**
 * Modal 序列化策略
 *
 * 节点 data.modal 在内存中保存完整模型配置（含 API Key），但**持久化时只允许输出模型 ID 引用**，
 * 防止 API Key / URL / Token 配置泄露到工作流 JSON、版本快照或导出文件中。
 *
 * - strip（落盘/导出）：modal → { id, alias }（无 id 的旧数据退化为 { name, alias }）
 * - hydrate（读取/导入）：modal → 从 model.conf.json 按 id（或 modelName 兼容旧格式）还原完整配置
 */

/** 落盘/导出时剥离敏感字段，只保留模型引用 */
export function stripModal(
  modal: Record<string, any> | undefined,
): Record<string, any> | undefined {
  if (!modal) return modal
  const stripped: Record<string, any> = {}
  if (modal.id) stripped.id = modal.id
  else if (modal.name) stripped.name = modal.name // 兼容旧格式（无 id 时以 modelName 作引用）
  if (modal.alias) stripped.alias = modal.alias
  return Object.keys(stripped).length > 0 ? stripped : undefined
}

/** 读取/导入时按 id 还原完整模型配置；已含完整配置（key/url）则视为内存态，仅补 id */
export function hydrateModal(
  modal: Record<string, any> | undefined,
  models: Model[],
): Record<string, any> | undefined {
  if (!modal) return modal

  // 已是完整配置（含 key 或 url）：内存态，仅尝试补上模型 id
  if (modal.key || modal.url) {
    if (!modal.id) {
      const m =
        models.find((x) => x.modelName === modal.name) ||
        models.find((x) => x.id === modal.id)
      if (m?.id) return { ...modal, id: m.id }
    }
    return modal
  }

  // 引用态：按 id 优先、modelName 兜底，从 model.conf.json 还原
  const model =
    models.find((m) => m.id === modal.id) ||
    models.find((m) => m.modelName === modal.name)
  if (!model) return modal

  return {
    ...modal,
    id: model.id,
    name: model.modelName,
    key: model.apiKey,
    url: model.url,
    token: model.token
      ? { min: model.token.min, max: model.token.max }
      : undefined,
  }
}

/** 剥离单个节点的 modal */
export function stripNodeModal(node: any): any {
  if (!node?.data?.modal) return node
  return { ...node, data: { ...node.data, modal: stripModal(node.data.modal) } }
}

/** 剥离一批节点的 modal */
export function stripNodesModals(nodes: any[]): any[] {
  return nodes.map(stripNodeModal)
}

/** 还原单个节点的 modal */
export function hydrateNodeModal(node: any, models: Model[]): any {
  if (!node?.data?.modal) return node
  return { ...node, data: { ...node.data, modal: hydrateModal(node.data.modal, models) } }
}

/** 还原一批节点的 modal */
export function hydrateNodesModals(nodes: any[], models: Model[]): any[] {
  return nodes.map((n) => hydrateNodeModal(n, models))
}
