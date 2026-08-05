import { useEffect } from 'react'
import { useNodeStore } from '#/store/node'
import { useModelStore } from '#/store/model'
import type { NTaskPlanner, NTaskPlannerData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { Typography, Select, Divider, Input } from 'antd'
import { DynEditKV } from './item'
import { EditButton } from '#/components/button'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NTaskPlannerData

export const EditTaskPlanner = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NTaskPlanner>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const models = useModelStore((state) => state.models)
  const fetchModels = useModelStore((state) => state.fetchModels)

  const selectedModelId = currentNode.data.modal?.name || undefined

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  const rows = [
    {
      key: 'model',
      label: 'AI 模型',
      valueRender: (onChange: (v: any) => void) => (
        <Select
          style={{ flex: 1, width: '100%' }}
          placeholder="选择模型"
          value={selectedModelId}
          notFoundContent="暂无模型，请先在「规则与模型」中添加"
          options={models.map((m) => ({
            label: `${m.name} (${m.modelName})`,
            value: m.name,
          }))}
          onChange={(modelName) => {
            const model = models.find((m) => m.name === modelName)
            if (model) {
              onChange({
                id: model.id,
                name: model.modelName,
                key: model.apiKey || '',
                url: model.url || '',
                token: model.token || { min: 100, max: 4096 },
                alias: model.name,
              })
            } else {
              onChange(undefined)
            }
          }}
          allowClear
          onClear={() => onChange(undefined)}
        />
      ),
    },
    {
      key: 'prompt',
      label: '系统提示词',
      value: 'taskPlanner.md',
      readOnly: true,
      actionRender: <EditButton.To url={'prompts/taskPlanner.md'} isEdit />,
    },
  ]

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          读取上游「概设/二次分析」节点的技术方案（plan），调用 AI
          拆解为分批次任务清单 tasks.md，不直接写代码
        </Text>
      </div>

      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            if (key === 'model') {
              data.modal = value || undefined
            }
          })
        }}
      />

      {/* 自定义拆解指令 */}
      <Divider style={{ margin: '12px 0', fontSize: 12 }}>
        拆解指令（可选）
      </Divider>
      <div style={{ marginBottom: 6, padding: '0 4px' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          追加到系统提示词之后，用于限定批次粒度、技术栈、验收口径等
        </Text>
      </div>
      <Input.TextArea
        value={currentNode.data.instruction || ''}
        placeholder="例：每个 Batch 只涉及 3 个以内的文件；验收标准必须可自动化检查"
        autoSize={{ minRows: 2, maxRows: 6 }}
        onChange={(e) => {
          patchCurrentNode((draft) => {
            const data = d(draft)
            data.instruction = e.target.value
          })
        }}
      />
    </>
  )
}
