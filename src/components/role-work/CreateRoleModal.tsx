import { useEffect, useMemo, useState } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import { useBmadAgentStore } from '#/store/bmad'
import { useRoleWorkStore } from './store'

interface CreateRoleModalProps {
  open: boolean
  onClose: () => void
}

interface FormValues {
  name: string
  bmadId?: string
  modelName: string
  skill: string
}

/**
 * 创建角色弹窗：基于 BMad 角色预设 + 选择 AI 模型。
 * 选择 BMad 角色后，自动填充 name 与 skill（SKILL.md 内容）。
 */
export const CreateRoleModal = ({ open, onClose }: CreateRoleModalProps) => {
  const [form] = Form.useForm<FormValues>()
  const agents = useBmadAgentStore((s) => s.agents)
  const fetchAgents = useBmadAgentStore((s) => s.fetchAgents)
  const addRole = useRoleWorkStore((s) => s.addRole)
  const [modelOptions, setModelOptions] = useState<{ label: string; value: string }[]>([])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // 模型选项：直接从 model store 的 fetch 接口拉取
  useEffect(() => {
    if (!open) return
    fetch('/api/model')
      .then((r) => r.json())
      .then((models: { name: string; modelName: string }[]) => {
        setModelOptions(models.map((m) => ({ label: `${m.name} (${m.modelName})`, value: m.name })))
      })
      .catch(() => setModelOptions([]))
  }, [open])

  const bmadOptions = useMemo(
    () =>
      agents.map((a) => ({
        label: `${a.icon} ${a.name} — ${a.title}`,
        value: a.id,
      })),
    [agents],
  )

  const handleBmadChange = (bmadId: string) => {
    const agent = agents.find((a) => a.id === bmadId)
    if (!agent) return
    form.setFieldsValue({
      name: agent.name,
      skill: agent.skillContent || agent.description || '',
    })
  }

  const handleOk = async () => {
    const vals = await form.validateFields()
    addRole({
      name: vals.name,
      skill: vals.skill,
      modelName: vals.modelName,
      bmadId: vals.bmadId,
    })
    form.resetFields()
    onClose()
  }

  const handleClose = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="创建角色"
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      okText="创建"
      cancelText="取消"
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item label="BMad 角色预设" name="bmadId">
          <Select
            placeholder="选择 BMad 角色（可选，自动填充名称与指令）"
            options={bmadOptions}
            allowClear
            showSearch
            optionFilterProp="label"
            onChange={handleBmadChange}
          />
        </Form.Item>
        <Form.Item
          name="name"
          label="角色名称"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="如：Mary（业务分析师）" />
        </Form.Item>
        <Form.Item
          name="modelName"
          label="AI 模型"
          rules={[{ required: true, message: '请选择模型' }]}
        >
          <Select placeholder="选择该角色使用的 AI 模型" options={modelOptions} showSearch optionFilterProp="label" />
        </Form.Item>
        <Form.Item name="skill" label="角色指令（SKILL）">
          <Input.TextArea
            placeholder="角色的系统指令，可作为该角色的 SKILL 注入 AI"
            autoSize={{ minRows: 3, maxRows: 8 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
