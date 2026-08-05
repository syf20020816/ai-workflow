/**
 * 任务清单（tasks.md）解析与进度管理
 *
 * tasks.md 是 TASK_PLANNER 节点的产出，格式约定：
 *   ## Batch 1 · 基础配置与骨架
 *   - [ ] T-01 扩展 props.js 新增 statRange 字段
 *       - 文件：src/props.js
 *       - 前置：无
 *       - 验收：新增字段类型正确、默认值对齐 Figma
 *   - [x] T-02 已完成任务
 *
 * 本模块为纯函数（无 I/O），前端 / 服务端共用。
 * batch 模式下通过「打勾」持久化进度：重跑时已完成批次自动跳过，实现断点续跑。
 */

export type TaskItem = {
  /** 任务编号，如 T-01 */
  id: string
  /** 任务标题 */
  title: string
  /** 目标文件 */
  files?: string
  /** 前置依赖 */
  deps?: string
  /** 验收标准 */
  accept?: string
  /** 是否已完成（- [x]） */
  checked: boolean
}

export type TaskBatch = {
  /** 批次号（1 起） */
  index: number
  /** 批次标题（"Batch N" 后的说明文字） */
  title: string
  tasks: TaskItem[]
}

/** 批次标题：## Batch N · 标题 */
const BATCH_RE = /^##\s*Batch\s+(\d+)[\s·\-—:：]*(.*)$/gm
/** 任务行：- [ ] T-01 标题 */
const TASK_LINE_RE = /^- \[([ xX])\]\s*(T-\d+)\s*(.*)$/
/** 任务属性行：- 文件： / - 前置： / - 验收： */
const ATTR_RE = /^-\s*(文件|前置|验收)[：:]\s*(.*)$/

/** 解析 tasks.md → 批次列表（已完成打勾状态落在 checked 上） */
export function parseTasks(markdown: string): TaskBatch[] {
  const batches: TaskBatch[] = []
  const batchMatches = [...markdown.matchAll(BATCH_RE)]

  for (let i = 0; i < batchMatches.length; i++) {
    const m = batchMatches[i]
    const index = Number(m[1])
    const start = (m.index ?? 0) + m[0].length
    const end =
      i + 1 < batchMatches.length
        ? (batchMatches[i + 1].index ?? markdown.length)
        : markdown.length
    const block = markdown.slice(start, end)

    const tasks: TaskItem[] = []
    let current: TaskItem | null = null

    for (const line of block.split('\n')) {
      const tl = TASK_LINE_RE.exec(line)
      if (tl) {
        if (current) tasks.push(current)
        current = {
          id: tl[2],
          title: tl[3].trim(),
          checked: tl[1].trim() !== '',
        }
        continue
      }
      if (current) {
        const at = ATTR_RE.exec(line.trim())
        if (at) {
          const [, key, val] = at
          if (key === '文件') current.files = val.trim()
          else if (key === '前置') current.deps = val.trim()
          else if (key === '验收') current.accept = val.trim()
        }
      }
    }
    if (current) tasks.push(current)

    batches.push({ index, title: m[2].trim(), tasks })
  }

  return batches
}

/** 把某批次的所有任务标记为完成（- [ ] → - [x]），返回更新后的全文（找不到批次则原样返回） */
export function markBatchDone(markdown: string, batchIndex: number): string {
  const batchMatches = [...markdown.matchAll(BATCH_RE)]
  const m = batchMatches.find((bm) => Number(bm[1]) === batchIndex)
  if (!m) return markdown

  const start = m.index ?? 0
  const end = (() => {
    const next = batchMatches.find((bm) => Number(bm[1]) > batchIndex)
    return next ? (next.index ?? markdown.length) : markdown.length
  })()

  const block = markdown.slice(start, end)
  const newBlock = block.replace(/^- \[ \]\s*(T-\d+)/gm, '- [x] $1')
  return markdown.slice(0, start) + newBlock + markdown.slice(end)
}

/** 获取第一个含未完成任务的批次（批次号 > fromIndex），全部完成返回 null（用于续跑） */
export function getNextBatch(
  batches: TaskBatch[],
  fromIndex = 0,
): TaskBatch | null {
  for (const b of batches) {
    if (b.index <= fromIndex) continue
    if (b.tasks.some((t) => !t.checked)) return b
  }
  return null
}

/** 把批次格式化为可放入 prompt 的任务清单文本 */
export function formatBatch(batch: TaskBatch): string {
  const lines = [`## Batch ${batch.index} · ${batch.title}`]
  for (const t of batch.tasks) {
    lines.push(`- [${t.checked ? 'x' : ' '}] ${t.id} ${t.title}`)
    if (t.files) lines.push(`    - 文件：${t.files}`)
    if (t.deps) lines.push(`    - 前置：${t.deps}`)
    if (t.accept) lines.push(`    - 验收：${t.accept}`)
  }
  return lines.join('\n')
}
