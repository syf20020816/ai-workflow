import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import { parseBmadAgents } from '#/engine/bmad/parser'

/** BMad 项目根目录（ai-workflow 的相邻目录） */
const BMAD_ROOT = path.resolve(process.cwd(), '.bmad')
const CONFIG_PATH = path.join(BMAD_ROOT, '_bmad', 'config.toml')

/** 角色指令目录：.bmad/agents/<agentId>/SKILL.md */
const SKILL_DIR = path.join(BMAD_ROOT, 'agents')

/** 转义 TOML 字符串值中的引号与反斜杠 */
function escapeToml(value: unknown): string {
  return String(typeof value === 'string' ? value : '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

/** 读取角色的完整指令（SKILL.md），文件不存在时返回 undefined */
function readSkillContent(agentId: string): string | undefined {
  if (!/^[a-zA-Z0-9-]+$/.test(agentId)) return undefined
  const skillPath = path.join(SKILL_DIR, agentId, 'SKILL.md')
  try {
    return fs.readFileSync(skillPath, 'utf-8')
  } catch {
    return undefined
  }
}

/** 为新角色生成初始 SKILL.md 模板（可后续在平台编辑） */
function buildInitialSkill(agent: {
  id: string
  name: string
  title: string
  icon?: string
  description: string
}): string {
  return `---
name: ${agent.id}
description: ${agent.description}
---

# ${agent.icon ? agent.icon + ' ' : ''}${agent.name} — ${agent.title}

> 本文件为角色指令，可在此直接编辑。内容将作为该角色的系统指令注入下游智能体。

## 角色定位

你是 ${agent.name}，${agent.title}。

## 描述

${agent.description}

## 任务约束

作为本工作流中的 ${agent.title} 角色，你需要：
1. 基于输入（需求、上游上下文）明确目标与范围
2. 输出结构化结论，每个结论给出依据
3. 对不确定的信息明确标注，不臆造事实
`
}

export const Route = createFileRoute('/api/bmad/agents')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const baseContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
          const agents = parseBmadAgents(baseContent).map((a) => ({
            ...a,
            skillContent: readSkillContent(a.id),
          }))
          return Response.json(agents)
        } catch (err: any) {
          return Response.json(
            { error: 'Failed to read BMad config', detail: err.message },
            { status: 500 },
          )
        }
      },

      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { id, module, team, name, title, icon, description } = body

        if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
          return Response.json(
            { error: '角色 ID 只能包含字母、数字和连字符' },
            { status: 400 },
          )
        }
        if (!name || !title) {
          return Response.json(
            { error: 'name 与 title 为必填项' },
            { status: 400 },
          )
        }

        // 防重复：已存在同 id 角色则拒绝
        let existing = ''
        try {
          existing = fs.readFileSync(CONFIG_PATH, 'utf-8')
        } catch { /* 文件可能不存在 */ }

        if (parseBmadAgents(existing).some((a) => a.id === id)) {
          return Response.json(
            { error: `角色 ${id} 已存在` },
            { status: 400 },
          )
        }

        // 追加 [agents.<id>] 段到 config.toml
        const section = [
          '',
          `[agents.${id}]`,
          `module = "${escapeToml(module)}"`,
          `team = "${escapeToml(team)}"`,
          `name = "${escapeToml(name)}"`,
          `title = "${escapeToml(title)}"`,
          icon ? `icon = "${escapeToml(icon)}"` : null,
          `description = "${escapeToml(description)}"`,
        ]
          .filter((l): l is string => l !== null)
          .join('\n')

        const next =
          existing.length === 0
            ? section + '\n'
            : existing.endsWith('\n')
              ? existing + section + '\n'
              : existing + '\n' + section + '\n'

        fs.writeFileSync(CONFIG_PATH, next, 'utf-8')

        // 生成初始角色指令文件
        try {
          const skillDir = path.join(SKILL_DIR, id)
          fs.mkdirSync(skillDir, { recursive: true })
          fs.writeFileSync(
            path.join(skillDir, 'SKILL.md'),
            buildInitialSkill({ id, name, title, icon, description }),
            'utf-8',
          )
        } catch { /* 指令文件生成失败不影响角色创建 */ }

        return Response.json({ success: true, id })
      },
    },
  },
})
