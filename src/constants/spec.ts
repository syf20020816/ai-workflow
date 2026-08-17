/**
 * Spec 阶段标记定义（Spec 模式专用）
 *
 * 使用者通过节点上的脚印按钮（StepMarkNode）手动标记该节点输出属于工作流的哪个阶段，
 * 平台本身不产出任何 spec 文件 —— 编排完成后导出 workflow.yml，交由 openspec / speckit
 * 等专业 spec 框架在用户自己的 Codex / Trae 工具中生成 specs/ 目录。
 */

export const SPEC_STEPS = [
  { key: 'spec', label: '功能规格', required: true },
  { key: 'plan', label: '技术方案', required: true },
  { key: 'tasks', label: '分批次任务清单', required: true },
  { key: 'report', label: '自检报告', required: false },
  { key: 'research', label: '调研分析', required: false },
  { key: 'data-model', label: '数据模型', required: false },
  { key: 'contracts', label: '接口契约', required: false },
  { key: 'adr', label: '架构决策记录', required: false },
] as const

export type SpecStepKey = (typeof SPEC_STEPS)[number]['key']

/** 从 key 取步骤定义 */
export function getSpecStep(key: string | undefined | null) {
  if (!key) return undefined
  return SPEC_STEPS.find((s) => s.key === key)
}
