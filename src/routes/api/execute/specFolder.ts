import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Spec 产出文件夹管理 API
 *
 * Spec 模式（界面右上角「Spec/常规」切换）下，引擎在每次执行前调用 init 创建
 * 标准目录骨架，执行过程中把各节点产物写入对应文件（spec.md / plan.md / tasks.md /
 * check_reports / session 黑匣子等）。文件系统操作必须走服务端（浏览器无法访问 fs）。
 *
 * action:
 *   - init  { workflowId, title }        → 创建 specs/<title>_<timestamp>/ 骨架，返回 specRoot
 *   - write { specRoot, filename, content } → 写入/覆盖骨架内文件
 *   - read  { specRoot, filename }       → 读取骨架内文件内容
 *   - list  { specRoot }                 → 列出骨架内全部文件（相对路径）
 */

const SPECS_DIR = path.resolve(process.cwd(), 'workflows/specs')

/** 规格目录骨架：相对路径 → 初始占位内容 */
const SKELETON: Record<string, string> = {
  'spec.md': '# spec.md\n\n> Spec 目录骨架占位。需求对齐阶段（功能规格 FR / 成功标准 SC / Given-When-Then）产物将写入此文件。\n',
  'plan.md': '# plan.md\n\n> 占位。技术方案（概设）产物将写入此文件。\n',
  'tasks.md': '# tasks.md\n\n> 占位。分批次任务清单（Batch / T-*）产物将写入此文件。\n',
  'research.md': '# research.md\n\n> 占位。调研/知识库检索等过程件将写入此文件。\n',
  'check_reports/check_summary.md': '# check_summary.md\n\n> 占位。自检汇总报告（overall_result: PASS / CONDITIONAL_PASS / FAIL）将写入此文件。\n',
  'session/conversation-log.md': '# conversation-log.md\n\n> 本次执行全过程节点日志，按执行顺序追加。\n\n',
}

/** 校验 specRoot 必须位于 SPECS_DIR 之下，且 filename 不可包含路径穿越（..） */
function safeResolve(specRoot: string, filename: string): string | null {
  const root = path.resolve(specRoot)
  if (!root.startsWith(SPECS_DIR)) return null
  const resolved = path.resolve(root, filename)
  if (!resolved.startsWith(root)) return null
  if (path.relative(root, resolved).split(path.sep).includes('..')) return null
  return resolved
}

/** 将标题中的非法路径字符替换为 - */
function sanitizeTitle(title: string): string {
  const t = title.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-')
  return t || 'workflow'
}

export const Route = createFileRoute('/api/execute/specFolder')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { action } = body

        try {
          switch (action) {
            case 'init': {
              const { workflowId, title } = body
              const dirName = `${sanitizeTitle(title || workflowId || 'workflow')}_${Date.now()}`
              const specRoot = path.join(SPECS_DIR, dirName)
              fs.mkdirSync(specRoot, { recursive: true })

              // 子目录
              for (const sub of ['check_reports', 'session', 'contracts', 'adr']) {
                fs.mkdirSync(path.join(specRoot, sub), { recursive: true })
              }

              // 占位文件
              for (const [rel, content] of Object.entries(SKELETON)) {
                const filePath = safeResolve(specRoot, rel)
                if (filePath) fs.writeFileSync(filePath, content, 'utf-8')
              }

              return Response.json({ status: 'success', specRoot })
            }

            case 'write': {
              const { specRoot, filename, content } = body
              if (!specRoot || !filename) {
                return Response.json({ status: 'error', error: '缺少 specRoot 或 filename' })
              }
              const filePath = safeResolve(specRoot, filename)
              if (!filePath) {
                return Response.json({ status: 'error', error: '非法路径（仅允许写入 spec 目录内）' })
              }
              fs.mkdirSync(path.dirname(filePath), { recursive: true })
              fs.writeFileSync(filePath, content || '', 'utf-8')
              return Response.json({ status: 'success', specRoot, filename })
            }

            case 'read': {
              const { specRoot, filename } = body
              if (!specRoot || !filename) {
                return Response.json({ status: 'error', error: '缺少 specRoot 或 filename' })
              }
              const filePath = safeResolve(specRoot, filename)
              if (!filePath || !fs.existsSync(filePath)) {
                return Response.json({ status: 'error', error: '文件不存在或路径非法' })
              }
              return Response.json({ status: 'success', content: fs.readFileSync(filePath, 'utf-8') })
            }

            case 'list': {
              const { specRoot } = body
              if (!specRoot || !path.resolve(specRoot).startsWith(SPECS_DIR)) {
                return Response.json({ status: 'error', error: '非法 specRoot' })
              }
              const files: string[] = []
              const walk = (dir: string, base: string) => {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  const abs = path.join(dir, entry.name)
                  const rel = path.join(base, entry.name)
                  if (entry.isDirectory()) walk(abs, rel)
                  else files.push(rel)
                }
              }
              if (fs.existsSync(specRoot)) walk(specRoot, '')
              return Response.json({ status: 'success', files })
            }

            default:
              return Response.json({ status: 'error', error: `未知 action: ${action}` })
          }
        } catch (err: any) {
          return Response.json({
            status: 'error',
            error: `Spec 文件夹操作失败: ${err.message}`,
          })
        }
      },
    },
  },
})
