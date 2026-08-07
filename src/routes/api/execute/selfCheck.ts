import { createFileRoute } from '@tanstack/react-router'
import { callAI } from '#/services/ai'
import { readSpecArtifact } from '#/services/specFolder'
import { buildUpstreamBlocks, blocksToText } from '#/services/upstreamContext'
import { NodeTypes } from '#/types'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execSync } from 'node:child_process'

/**
 * SelfCheck 自检 Agent 执行 API（P1-3）
 *
 * 核心原则：独立会话 · 独立上下文 —— 不共享上游编码 Agent 的记忆（防确认偏差）。
 * 以节点选择的 BMad 角色（自带视角身份）对交付物做一次独立评审。
 * 一个自检节点 = 一个角色；多视角检验 = 创建多个自检节点。
 *
 * 评审材料按可用性自动降级：
 *   1. Spec 产物（spec.md / plan.md / tasks.md）—— Spec 模式
 *   2. 项目 git diff —— 常规模式放在 codeAgent 之后的编码检测（ground truth）
 *   3. 上游累积产物 —— 常规模式接其他节点（AIAgent / 飞书文档等）的文档类场景
 * 产出：评审报告（写 check_reports/check_summary.md），overall 结论（PASS/CONDITIONAL_PASS/FAIL）。
 */

/** 无角色时的默认评审身份描述 */
const DEFAULT_ROLE_DESC =
  '你是一名严谨的质量评审员。对交付物进行独立评审：对照需求与验收标准，检查内容是否完整、准确、可执行，有无遗漏或质量问题。只允许输出 PASS / CONDITIONAL_PASS / FAIL 总体结论，并附逐条证据。'

/** 读取文件（不存在返回空字符串） */
async function readFileSafe(fp: string): Promise<string> {
  try {
    const content = await readFile(fp, 'utf-8')
    return content.trim()
  } catch {
    return ''
  }
}

/** 收集待检材料：Spec 产物 → git diff → 上游累积产物（按可用性自动降级） */
async function collectMaterials(input: {
  specRoot?: string
  projectPath?: string
  instruction?: string
  upstreams?: any[]
  tokenMax?: number
}): Promise<{ text: string; logs: string[] }> {
  const logs: string[] = []
  const sections: string[] = []
  const upstreams = input.upstreams || []

  // 1. Spec 产物（spec.md / plan.md / tasks.md）—— Spec 模式优先
  if (input.specRoot) {
    for (const file of ['spec.md', 'plan.md', 'tasks.md']) {
      const content = await readSpecArtifact(input.specRoot, file)
      if (content && content.trim().length > 0) {
        sections.push(`## 产物文档：${file}\n${content.trim()}`)
        logs.push(`已读取 Spec 产物: ${file}`)
      }
    }
  }

  // 2. 项目 git diff（未提交改动，前后对比）—— 编码场景 ground truth
  let projectRoot = ''
  if (input.projectPath) {
    projectRoot = path.isAbsolute(input.projectPath)
      ? input.projectPath
      : path.resolve(process.cwd(), input.projectPath)
  }
  if (projectRoot) {
    try {
      const diff = execSync('git diff HEAD', { cwd: projectRoot, stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 })
        .toString()
        .slice(0, 60000)
      if (diff.trim()) {
        sections.push(`## 代码变更（git diff HEAD）\n${diff}`)
        logs.push('已读取项目 git diff')
      }
    } catch {
      logs.push('git diff 读取失败（可能不是 git 仓库），跳过代码变更')
    }
    try {
      const status = execSync('git status --short', { cwd: projectRoot, stdio: 'pipe' })
        .toString()
        .slice(0, 4000)
      if (status.trim()) {
        sections.push(`## 工作区状态（git status）\n${status}`)
      }
    } catch {
      // 忽略
    }
  }

  // 3. 上游累积产物 —— 文档类场景兜底。
  //    仅当既无 Spec 产物、又无 git diff 时才读取；上游为 codeAgent 时不回退到其自述（与独立性原则冲突）
  const hasUpstreamCodeAgent = upstreams.some(
    (u) => u?.nodeType === NodeTypes.CODE_AGENT,
  )
  if (sections.length === 0 && upstreams.length > 0 && !hasUpstreamCodeAgent) {
    const blocks = buildUpstreamBlocks({ upstreams }, input.tokenMax)
    const text = blocksToText(blocks)
    if (text.trim()) {
      sections.push(`## 上游产物（工作流累积上下文，含原始需求与最终交付物）\n${text.trim()}`)
      logs.push(`已读取上游累积产物（${upstreams.length} 个上游节点）`)
    }
  }

  // 4. 节点指令
  if (input.instruction && input.instruction.trim()) {
    sections.push(`## 评审补充指令\n${input.instruction.trim()}`)
  }

  // 5. 无材料时给出可操作的报错引导
  if (sections.length === 0) {
    if (hasUpstreamCodeAgent) {
      logs.push('检测到上游为代码处理（codeAgent）节点，但未读取到 git diff：请在自检节点配置「项目路径」')
    } else {
      logs.push('未收集到任何待检材料（无 Spec 产物、无项目路径、无上游产物、无指令）')
    }
  }

  return { text: sections.join('\n\n---\n\n'), logs }
}

export const Route = createFileRoute('/api/execute/selfCheck')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { modal, specRoot, projectPath, instruction, role, roleDesc, upstreams } = body

        if (!modal?.url || !modal?.name) {
          return Response.json(
            { error: '模型配置不完整，缺少 url 或 name' },
            { status: 400 },
          )
        }

        const logs: string[] = []
        const model = {
          name: modal.name,
          key: modal.key || '',
          url: modal.url,
          token: modal.token,
        }

        // 1. 收集待检材料
        const { text: materials, logs: materialLogs } = await collectMaterials({
          specRoot,
          projectPath,
          instruction,
          upstreams,
          tokenMax: modal.token?.max,
        })
        logs.push(...materialLogs)
        if (!materials) {
          return Response.json({
            status: 'error',
            output: {},
            logs,
            error: logs[logs.length - 1] || '未收集到待检材料',
          })
        }

        // 2. 独立评审会话（BMad 角色 SKILL 直接注入，自带视角身份）
        logs.push(`启动独立评审（角色: ${role || '默认'}）...`)
        let report = ''
        let overall = 'FAIL'
        let usage = 0
        try {
          const mainSystemPrompt = await readFileSafe(
            path.join(process.cwd(), 'prompts', 'selfCheck.md'),
          )
          // 角色 SKILL 优先，无则用默认评审身份 + 通用框架
          const roleSystem = roleDesc?.trim()
            ? `${roleDesc.trim()}\n\n${mainSystemPrompt || ''}`
            : `${DEFAULT_ROLE_DESC}\n\n${mainSystemPrompt || ''}`
          const result = await callAI({
            model,
            systemPrompt: roleSystem.trim(),
            messages: [{ role: 'user', content: materials }],
            temperature: 0.2,
          })
          report = result.text
          usage = result.usage?.totalTokens || 0
          const overallMatch = report.match(
            /overall[_ ]result\s*[:：]\s*(PASS|CONDITIONAL_PASS|FAIL)/i,
          )
          overall = overallMatch ? overallMatch[1].toUpperCase() : 'FAIL'
          logs.push(`评审完成，overall: ${overall}`)
        } catch (err: any) {
          return Response.json({
            status: 'error',
            output: {},
            logs: [...logs, `独立评审失败: ${err.message}`],
            error: `自检评审失败: ${err.message}`,
          })
        }

        // 3. 写盘（check_reports/ 目录：优先 specRoot，其次项目根）
        let checkDir = ''
        const baseDir = specRoot || projectPath || ''
        if (baseDir) {
          const root = path.isAbsolute(baseDir) ? baseDir : path.resolve(process.cwd(), baseDir)
          try {
            checkDir = path.join(root, 'check_reports')
            await mkdir(checkDir, { recursive: true })
            await writeFile(path.join(checkDir, 'check_summary.md'), report, 'utf-8')
            logs.push(`评审报告已写入: ${path.join(checkDir, 'check_summary.md')}`)
          } catch (err: any) {
            logs.push(`报告写盘失败（不影响返回结果）: ${err.message}`)
          }
        }

        return Response.json({
          status: 'success',
          output: {
            response: report,
            overallResult: overall,
            checkDir: checkDir || undefined,
            model: modal.name,
            role: role,
            usage: { totalTokens: usage },
          },
          logs,
        })
      },
    },
  },
})
