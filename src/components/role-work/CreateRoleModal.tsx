import { useEffect, useMemo, useState } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import { useBmadAgentStore } from '#/store/bmad'
import { useRoleWorkStore } from './store'
import { ASSETS } from './assets'
import styles from './index.module.scss'

interface CreateRoleModalProps {
  open: boolean
  onClose: () => void
}

interface FormValues {
  name: string
  bmadId?: string
  modelName: string
  skill: string
  spriteIndex: number
}

/**
 * 创建角色弹窗：基于 BMad 角色预设 + 选择 AI 模型 + 选择角色形象（6 张独立头像）。
 * 选择 BMad 角色后，自动填充 name 与 skill（SKILL.md 内容）。
 */
export const CreateRoleModal = ({ open, onClose }: CreateRoleModalProps) => {
  const [form] = Form.useForm<FormValues>()
  const agents = useBmadAgentStore((s) => s.agents)
  const fetchAgents = useBmadAgentStore((s) => s.fetchAgents)
  const addRole = useRoleWorkStore((s) => s.addRole)
  const [modelOptions, setModelOptions] = useState<{ label: string; value: string }[]>([])
  const [selectedSprite, setSelectedSprite] = useState(0)

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  useEffect(() => {
    if (!open) return
    fetch('/api/model')
      .then((r) => r.json())
      .then((models: { name: string; modelName: string }[]) => {
        setModelOptions(models.map((m) => ({ label: `${m.name} (${m.modelName})`, value: m.name })))
      })
      .catch(() => setModelOptions([]))
    setSelectedSprite(0)
    form.resetFields()
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

  const handleSpriteSelect = (index: number) => {
    setSelectedSprite(index)
    form.setFieldsValue({ spriteIndex: index })
  }

  const handleOk = async () => {
    const vals = await form.validateFields()
    addRole({
      name: vals.name,
      skill: vals.skill,
      modelName: vals.modelName,
      bmadId: vals.bmadId,
      spriteIndex: vals.spriteIndex !== undefined ? vals.spriteIndex : selectedSprite,
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
      <Form form={form} layout="vertical" initialValues={{ spriteIndex: 0 }}>
        <Form.Item label="选择角色形象">
          <div className={styles.spriteGrid}>
            {ASSETS.roleAvatars.map((url, index) => (
              <div
                key={index}
                className={`${styles.spriteSlot} ${
                  selectedSprite === index ? styles.spriteSlotActive : ''
                }`}
                onClick={() => handleSpriteSelect(index)}
              >
                <img className={styles.spritePreview} src={url} alt={`角色 ${index + 1}`} />
              </div>
            ))}
          </div>
        </Form.Item>
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
        {/* 隐藏字段：提交 spriteIndex */}
        <Form.Item name="spriteIndex" hidden>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  )
}
