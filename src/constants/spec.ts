/**
 * Spec 阶段产物定义（Spec 模式专用）
 *
 * 使用者通过节点上的脚印按钮（StepMarkNode）手动标记该节点输出属于哪个阶段产物，
 * 引擎在 Spec 模式下按标记把节点输出写入对应文件，避免按节点类型/标题自动推测的不可靠性。
 */

export const SPEC_STEPS = [
  { key: 'spec', label: '功能规格(spec: FR/SC/GWT)', file: 'spec.md', required: true },
  { key: 'plan', label: '技术方案(plan)', file: 'plan.md', required: true },
  { key: 'tasks', label: '分批次任务清单(tasks)', file: 'tasks.md', required: true },
  { key: 'report', label: '自检报告(report)', file: 'check_reports/check_summary.md', required: false },
  { key: 'research', label: '调研分析(research)', file: 'research.md', required: false },
  { key: 'data-model', label: '数据模型(data-model)', file: 'data-model.md', required: false },
  { key: 'contracts', label: '接口契约(contracts)', file: 'contracts/api.md', required: false },
  { key: 'adr', label: '架构决策记录(adr)', file: 'adr/ADR.md', required: false },
] as const

export type SpecStepKey = (typeof SPEC_STEPS)[number]['key']

/** 阶段产物 key → 产物文件（相对 spec 目录） */
export const SPEC_STEP_FILE: Record<SpecStepKey, string> = Object.fromEntries(
  SPEC_STEPS.map((s) => [s.key, s.file]),
) as Record<SpecStepKey, string>

/** 从 key 取步骤定义 */
export function getSpecStep(key: string | undefined | null) {
  if (!key) return undefined
  return SPEC_STEPS.find((s) => s.key === key)
}
