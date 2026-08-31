import { describe, expect, it } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildSpecKitWorkflow, buildOpenSpecWorkflow } from '#/services/exporter'

/** 构造测试节点 */
function makeNode(id: string, type: string, data: Record<string, unknown>): Node {
  return { id, type, position: { x: 0, y: 0 }, data: { title: id, ...data } }
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target, type: 'nodeEdge' }
}

describe('导出物管理', () => {
  const nodes = [
    makeNode('lark-1', 'lark', { url: 'https://x.feishu.cn/docx/abc', specStep: 'plan' }),
    makeNode('agent-1', 'agent', { specStep: 'plan' }),
    makeNode('task-1', 'taskPlanner', { specStep: 'tasks' }),
    makeNode('skill-1', 'skill', { skillId: '前端技术文档编写指南' }),
    makeNode('input-1', 'userInput', { input: { label: '需求描述', prompt: '写一个登录页' }, specStep: 'spec' }),
  ]
  const edges = [
    makeEdge('lark-1', 'agent-1'),
    makeEdge('agent-1', 'task-1'),
    makeEdge('skill-1', 'task-1'),
    makeEdge('input-1', 'lark-1'),
  ]

  it('speckit：lark+plan 生成 shell 拉取步骤，agent+plan 被跳过', () => {
    const { yaml } = buildSpecKitWorkflow(nodes, edges, { name: '测试' })
    expect(yaml).toContain("type: shell")
    expect(yaml).toContain(`lark-cli docs +fetch --doc "https://x.feishu.cn/docx/abc" --doc-format markdown --jq '.data.document.content' > plan.md`)
    // agent-1 (specStep: plan) 的产物已由 lark-1 提供，应被跳过
    expect(yaml).not.toContain('speckit.plan')
    // taskPlanner 正常导出
    expect(yaml).toContain('speckit.tasks')
    // 跳过注释
    expect(yaml).toContain('已由输入节点')
    // userInput gate + cp 步骤
    expect(yaml).toContain('cp inputs/user-input/')
    // 不生成 spec 占位文件说明（无 plan.md 模板内容）
    expect(yaml).not.toContain('由平台 plan 节点生成')
  })

  it('speckit：无 specStep 的输入节点不导出为 command 步骤', () => {
    const { yaml } = buildSpecKitWorkflow([makeNode('skill-2', 'skill', { skillId: 's' })], [])
    // skill 无 specStep：无 step、也不计入控制节点跳过注释
    expect(yaml).not.toContain('control node')
    expect(yaml).not.toContain('speckit.plan')
  })

  it('openspec：输入节点生成拉取指引，生成节点同名 artifact 跳过', () => {
    const { yaml, workflowPath } = buildOpenSpecWorkflow(nodes, edges, { name: '测试' })
    expect(yaml).toContain('lark-cli')
    expect(yaml).toContain('design.md')
    // design artifact 只出现一次（agent 的 plan→design 被 lark 覆盖）
    const designCount = (yaml.match(/- id: design/g) || []).length
    expect(designCount).toBe(1)
    // schema 路径为 openspec/schemas/<name>/schema.yaml
    expect(workflowPath).toBe('openspec/schemas/测试/schema.yaml')
  })
})
