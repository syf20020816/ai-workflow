/**
 * Spec 产出文件夹 · 前端服务
 *
 * 浏览器端封装：文件系统操作全部通过后端 API /api/execute/specFolder 完成。
 * 引擎在 Spec 模式下调用 init 创建骨架，执行中把节点产物写入对应文件。
 */

/** 创建 Spec 目录骨架，返回 specRoot 绝对路径（失败返回 null） */
export async function initSpecFolder(
  workflowId: string,
  title: string,
): Promise<string | null> {
  try {
    const res = await fetch('/api/execute/specFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init', workflowId, title }),
    })
    const json = await res.json()
    return json.status === 'success' ? json.specRoot : null
  } catch {
    return null
  }
}

/** 写入/覆盖 spec 目录内的产物文件（相对路径），失败静默返回 false */
export async function writeSpecArtifact(
  specRoot: string,
  filename: string,
  content: string,
): Promise<boolean> {
  try {
    const res = await fetch('/api/execute/specFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'write', specRoot, filename, content }),
    })
    const json = await res.json()
    return json.status === 'success'
  } catch {
    return false
  }
}

/** 读取 spec 目录内文件内容（失败返回 null） */
export async function readSpecArtifact(
  specRoot: string,
  filename: string,
): Promise<string | null> {
  try {
    const res = await fetch('/api/execute/specFolder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read', specRoot, filename }),
    })
    const json = await res.json()
    return json.status === 'success' ? json.content : null
  } catch {
    return null
  }
}
