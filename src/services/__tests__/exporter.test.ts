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
    // userInput + specStep 产出拉取型 artifact（静态内容作为产物）
    expect(yaml).toMatch(/- id: proposal[\s\S]*?inputs\/user-input\//)
    // schema 路径为 openspec/schemas/<name>/schema.yaml
    expect(workflowPath).toBe('openspec/schemas/测试/schema.yaml')
    // apply 跟踪 tasks.md
    expect(yaml).toContain('tracks: tasks.md')
  })

  it('openspec：处理节点产出生成型 artifact + lark write 反向挂接 + tasks 自动补全', () => {
    // singer-center 结构复刻：userInput → lark read → agent → codeAgent → lark write(specStep=plan)
    const scNodes = [
      makeNode('input-1', 'userInput', { input: { prompt: '需求描述' } }),
      makeNode('lark-read', 'lark', { url: 'https://x.feishu.cn/wiki/read' }),
      makeNode('memory-1', 'memory', { memoryPath: 'memory/memory.md' }),
      makeNode('agent-1', 'agent', { title: '需求文档梳理' }),
      makeNode('bmad-1', 'bmadAgent', {
        role: 'Senior Software Engineer',
        agentId: 'Amelia',
        roleDescription: 'Test-first discipline',
      }),
      makeNode('skill-1', 'skill', { skillId: '前端技术文档编写指南' }),
      makeNode('code-1', 'codeAgent', {
        title: '代码分析',
        instruction: '分析项目代码输出技术文档',
        projectPath: '/path/to/singer-center',
        branch: 'master',
      }),
      makeNode('lark-write', 'lark', { action: 'write', url: 'https://x.feishu.cn/wiki/target', specStep: 'plan' }),
    ]
    const scEdges = [
      makeEdge('input-1', 'lark-read'),
      makeEdge('lark-read', 'agent-1'),
      makeEdge('memory-1', 'agent-1'),
      makeEdge('agent-1', 'code-1'),
      makeEdge('bmad-1', 'code-1'),
      makeEdge('skill-1', 'code-1'),
      makeEdge('code-1', 'lark-write'),
    ]

    const { yaml } = buildOpenSpecWorkflow(scNodes, scEdges, { name: '音乐人中心' })

    // agent → proposal artifact（类型兜底），instruction 含输入上下文引用
    expect(yaml).toContain('- id: proposal')
    expect(yaml).toContain('## 输入上下文')
    expect(yaml).toContain('inputs/user-input/')
    expect(yaml).toContain('lark-cli docs +fetch')
    expect(yaml).toContain('memory/memory.md')

    // codeAgent 经 lark write 反向挂接获得 design artifact，instruction 含角色/路径/投递
    expect(yaml).toContain('- id: design')
    expect(yaml).toContain('## 角色')
    expect(yaml).toContain('Amelia')
    expect(yaml).toContain('/path/to/singer-center')
    expect(yaml).toContain('lark-cli docs +update --doc "https://x.feishu.cn/wiki/target" --command overwrite')
    expect(yaml).toContain('@design.md')

    // skill 引用注入 codeAgent 上下文
    expect(yaml).toContain('skills/前端技术文档编写指南/SKILL.md')

    // lark write 不产出独立 artifact、不被当作输入源
    expect(yaml).not.toContain('- id: deliver')

    // tasks 自动补全 + apply 跟踪
    expect(yaml).toContain('自动补全')
    expect(yaml).toContain('tracks: tasks.md')
    expect(yaml).toContain('apply:\n  requires:\n    - tasks\n  tracks: tasks.md')
  })

  it('speckit：lark write 生成投递 shell 步骤（不生成拉取步骤）', () => {
    const scNodes = [
      makeNode('code-1', 'codeAgent', { instruction: '分析代码' }),
      makeNode('lark-write', 'lark', { action: 'write', url: 'https://x.feishu.cn/wiki/target', specStep: 'plan' }),
    ]
    const { yaml } = buildSpecKitWorkflow(scNodes, [makeEdge('code-1', 'lark-write')], { name: '测试' })
    expect(yaml).toContain('lark-cli docs +update --doc "https://x.feishu.cn/wiki/target" --command overwrite --content @plan.md')
    // write 节点不被当作输入源拉取
    expect(yaml).not.toContain('+fetch')
  })
})
