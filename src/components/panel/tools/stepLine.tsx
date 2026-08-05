import { useGlobalStore } from '#/store/global'
import { useNodeStore } from '#/store/node'
import { Panel } from '@xyflow/react'
import type { PanelProps } from '@xyflow/react'
import { Checkbox, Tooltip } from 'antd'
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
      <div
        className={`${styles.stepLine} ${!isOpen && styles.stepLine_startCenter}`}
        style={{
          width: isOpen ? '140px' : '32px',
          padding: isOpen ? '12px' : '12px 0',
        }}
      >
        <div
          className={`${styles.stepLine_title} ${!isOpen && styles.stepLine_center}`}
        >
          {isOpen ? (
            <>
              Spec 阶段产物{' '}
              <PanelLeftClose
                style={{ cursor: 'pointer' }}
                height={16}
                onClick={() => setIsOpen(!isOpen)}
              >
                {' '}
              </PanelLeftClose>
            </>
          ) : (
            <PanelRightClose
              style={{ cursor: 'pointer' }}
              height={16}
              width={16}
              onClick={() => setIsOpen(!isOpen)}
            >
              {' '}
            </PanelRightClose>
          )}
        </div>
        {markedList.length >= 1 && (
          <Checkbox.Group
            disabled
            className={styles.stepLine_group}
            value={markedList.map((s) => s.key)}
          >
            {markedList.map((s) => (
              <Tooltip title={!isOpen ? s.label : ''} placement="right">
                <Checkbox key={s.key} value={s.key}>
                  {isOpen ? (s.required ? `*${s.label}` : s.label) : ''}
                </Checkbox>
              </Tooltip>
            ))}
          </Checkbox.Group>
        )}
      </div>
    </Panel>
  )
}
