import { useGlobalStore } from '#/store/global'
import { useNodeStore } from '#/store/node'
import { Button, Dropdown, Tooltip } from 'antd'
import { Check, Footprints } from 'lucide-react'
import type { MenuProps } from 'antd'
import { SPEC_STEPS } from '#/constants/spec'
import type { SpecStepKey } from '#/constants/spec'

/**
 * 阶段标记按钮，用于在 Spec 模式下标记当前节点的输出属于哪个阶段产物。
 * 使用者在节点上手动标记，引擎执行时按标记把输出写入对应产物文件（不靠自动推测）。
 */
export const StepMarkNode = ({
  node,
}: {
  node: { id: string; data?: { specStep?: string } }
}) => {
  const globalMode = useGlobalStore((state) => state.globalMode)
  const nodes  = useNodeStore((state) => state.nodes)
  const setNodes = useNodeStore((state) => state.setNodes)

  if (globalMode !== 'spec') {
    return null
  }

  // 从 store 读取标记状态，避免依赖 React Flow 节点组件重渲染
  const current = nodes.find((n) => n.id === node.id)?.data?.specStep as
    | string
    | undefined

  const items: MenuProps['items'] = SPEC_STEPS.map((s) => ({
    key: s.key,
    label: (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{s.required ? `*${s.label}` : s.label}</span>
        {current === s.key && <Check size={12} />}
      </span>
    ),
  }))

  const onClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    // 阻止菜单项点击事件冒泡到节点容器 onClick（否则 setCurrentNode 会用旧 data 覆盖 specStep）
    domEvent?.stopPropagation()

    // 再次点击同一项则取消标记
    const next = key === current ? undefined : (key as SpecStepKey)
    const updated = nodes.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, specStep: next } } : n,
    )
    setNodes(updated)
  }

  return (
    <Tooltip title={`标记阶段产出物（当前：${current || '未标记'}）`}>
      <Dropdown
        menu={{ items, onClick, selectedKeys: current ? [current] : [] }}
        trigger={['click']}
      >
        <Button
          size="small"
          color={current ? 'green' : 'red'}
          variant={'solid'}
          styles={{
            root: {
              height: 12,
              width: 12,
              padding: 0,
            },
          }}
        >
          <Footprints height={8} width={8} />
        </Button>
      </Dropdown>
    </Tooltip>
  )
}
