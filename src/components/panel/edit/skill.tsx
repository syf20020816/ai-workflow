import { useNodeStore } from '#/store/node'
import type { NSkill, NSkillData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { SkillSelect, ToolSelect } from '#/components/select'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'
import { EditButton } from '#/components/button'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NSkillData

export const EditSkill = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NSkill>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const skillId = currentNode.data.skillId || ''

  const rows: DynEditKVRow[] = [
    {
      key: 'tool',
      label: '本地工具',
      value: currentNode.data.tool || '',
      valueRender: (onChange) => (
        <ToolSelect
          style={{ width: '100%' }}         
          placeholder="选择本地工具（可选，用于加载该工具的本机技能）"
          value={currentNode.data.tool || undefined}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).tool = v || undefined
            })
            onChange(v)
          }}
        />
      ),
    },
    {
      key: 'skill',
      label: '选择技能',
      value: skillId,
      valueRender: (onChange) => (
        <SkillSelect
          style={{ width: '100%' }}
          placeholder="选择技能..."
          tool={currentNode.data.tool}
          value={currentNode.data.skillId || undefined}
          onChange={(value, skill) => {
            patchCurrentNode((draft) => {
              const data = d(draft)
              data.skillId = value || ''
              data.skillName = skill?.name || ''
            })
            onChange(value)
          }}
        />
      ),
      actionRender: (
        <div style={{ display: 'flex', gap: 2 }}>
          <EditButton.To url={`workflows/skills/${skillId}/skill.md`} isEdit />
        </div>
      ),
    },
  ]

  return <DynEditKV rows={rows} onChange={() => {}} />
}
