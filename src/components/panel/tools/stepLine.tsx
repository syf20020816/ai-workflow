import { useGlobalStore } from '#/store/global'
import { useNodeStore } from '#/store/node'
import { Panel } from '@xyflow/react'
import type { PanelProps } from '@xyflow/react'
import { Checkbox } from 'antd'
import { SPEC_STEPS } from '#/constants/spec'
import styles from '../index.module.scss'
import { PanelLeftClose, PanelRightClose } from 'lucide-react'

/**
 * Spec 阶段产物总览面板（Spec 模式下显示在画布左侧）。
 * 汇总当前工作流中所有节点已标记的阶段产物，必选项以 * 标注，并提示缺失的必选项。
 */
export const StepLinePanel = (props: PanelProps) => {
  const globalMode = useGlobalStore((state) => state.globalMode)
  const nodes = useNodeStore((state) => state.nodes)
  const isOpen = useGlobalStore((state) => state.isStepMenuOpen)
  const setIsOpen = useGlobalStore((state) => state.setIsStepMenuOpen)

  if (globalMode !== 'spec') {
    return null
  }

  // 汇总所有已标记的 step（去重，按 SPEC_STEPS 定义顺序展示）
  const marked = new Set<string>()
  for (const n of nodes) {
    const s = (n.data as { specStep?: string } | undefined)?.specStep
    if (s) marked.add(s)
  }

  const markedList = SPEC_STEPS.filter((s) => marked.has(s.key))
  const missingRequired = SPEC_STEPS.filter(
    (s) => s.required && !marked.has(s.key),
  )

  if (!isOpen) {
  }

  return (
    <Panel {...props}>
      {isOpen ? (
        <div className={styles.stepLine}>
          <div className={styles.stepLine_title}>
            Spec 阶段产物{' '}
            <PanelLeftClose height={16} onClick={() => setIsOpen(!isOpen)}>
              {' '}
            </PanelLeftClose>
          </div>
          {markedList.length === 0 ? (
            <div className={styles.stepLine_tip}>未标记任何阶段产物</div>
          ) : (
            <Checkbox.Group
              disabled
              className={styles.stepLine_group}
              options={markedList.map((s) => ({
                label: s.required ? `*${s.label}` : s.label,
                value: s.key,
              }))}
              value={markedList.map((s) => s.key)}
            />
          )}
          <div className={styles.stepLine_tip}>
            {markedList.length === 0 ? (
              <span className={styles.stepLine_warn}>
                运行时将提示：至少标记一个阶段产物
              </span>
            ) : missingRequired.length > 0 ? (
              <span className={styles.stepLine_warn}>
                缺失必选：{missingRequired.map((s) => s.key).join('、')}
              </span>
            ) : (
              <span className={styles.stepLine_ok}>必选步骤（带*）已齐全</span>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.stepLine} style={{width: 24, paddingLeft: 0, paddingRight: 0}}>
          <PanelRightClose height={16} onClick={() => setIsOpen(!isOpen)}>
            {' '}
          </PanelRightClose>
        </div>
      )}
    </Panel>
  )
}
