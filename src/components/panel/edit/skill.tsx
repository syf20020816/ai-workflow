import { useNodeStore } from '#/store/node'
import { useSkillStore } from '#/store/skill'
import type { NSkill, NSkillData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { useEffect } from 'react'
import { Select } from 'antd'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NSkillData

export const EditSkill = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NSkill>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const skills = useSkillStore((state) => state.skills)
  const fetchSkills = useSkillStore((state) => state.fetchSkills)

  useEffect(() => {
    fetchSkills()
  }, [])

  const rows: DynEditKVRow[] = [
    {
      key: 'skill',
      label: '选择技能',
      value: currentNode.data.skillId || '',
      valueRender: (onChange) => (
        <Select
          style={{ width: '100%' }}
          placeholder="选择技能..."
          value={currentNode.data.skillId || undefined}
          notFoundContent="暂无技能，请先在技能管理中添加"
          options={skills.map((s) => ({
            label: `${s.name}${s.description ? ` (${s.description})` : ''}`,
            value: s.id,
          }))}
          onChange={(value) => {
            const skill = skills.find((s) => s.id === value)
            patchCurrentNode((draft) => {
              const data = d(draft)
              data.skillId = value
              data.skillName = skill?.name || ''
            })
            onChange(value)
          }}
        />
      ),
      actionRender: (
        <div style={{ display: 'flex', gap: 2 }}>
          {/* 管理按钮已通过 Tab 切换实现 */}
        </div>
      ),
    },
  ]

  return <DynEditKV rows={rows} onChange={() => {}} />
}
