import { useModelStore } from '#/store/model'
import { Table, Button, Modal, Tag, Space, Input, InputNumber, Form, Select, message } from 'antd'
import { PlusIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { useEffect, useState } from 'react'
import type { Model } from '#/types/model'
import { ModalKinds } from '#/types/model'

const kindColorMap: Record<string, string> = {
  [ModalKinds.Local]: 'green',
  [ModalKinds.Cloud]: 'blue',
}

const kindLabelMap: Record<string, string> = {
  [ModalKinds.Local]: '本地',
  [ModalKinds.Cloud]: '云端',
}

export const ModelManager = () => {
  const models = useModelStore((state) => state.models)
  const loading = useModelStore((state) => state.loading)
  const fetchModels = useModelStore((state) => state.fetchModels)
  const createModel = useModelStore((state) => state.createModel)
  const updateModel = useModelStore((state) => state.updateModel)
  const deleteModel = useModelStore((state) => state.deleteModel)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchModels()
  }, [])

  const handleCreate = () => {
    setEditingModel(null)
    form.resetFields()
    form.setFieldsValue({ kind: ModalKinds.Cloud, token: { min: 100, max: 4096 } })
    setModalOpen(true)
  }

  const handleEdit = (record: Model) => {
    setEditingModel(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleDelete = (record: Model) => {
    Modal.confirm({
      title: `确认删除模型 "${record.name}"？`,
      content: '此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await deleteModel(record.id)
        message.success('已删除')
      },
    })
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (editingModel) {
        await updateModel({ ...editingModel, ...values })
        message.success('已更新')
      } else {
        await createModel(values)
        message.success('已创建')
      }
      setModalOpen(false)
    } catch {
      // validation failed
    }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      render: (name: string, record: Model) => (
        <Space>
          <Tag color={kindColorMap[record.kind]}>{kindLabelMap[record.kind]}</Tag>
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '模型',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 160,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
    },
    // {
    //   title: 'API URL',
    //   dataIndex: 'url',
    //   key: 'url',
    //   width: 200,
    //   ellipsis: true,
    //   render: (url: string) => url || '-',
    // },
    // {
    //   title: 'Token 范围',
    //   key: 'token',
    //   width: 140,
    //   render: (_: any, record: Model) =>
    //     record.token ? `${record.token.min} ~ ${record.token.max}` : '-',
    // },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: Model) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<Pencil1Icon />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<TrashIcon />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div style={{  width: '100%'}}>
      <h2 style={{ marginBottom: 16 }}>模型管理</h2>
      <Button
        type="primary"
        icon={<PlusIcon />}
        onClick={handleCreate}
        style={{ marginBottom: 12 }}
      >
        新增模型
      </Button>
      <Table
        dataSource={models}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
      />
      <Modal
        title={editingModel ? '编辑模型' : '新增模型'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editingModel ? '保存' : '创建'}
        cancelText="取消"
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '云端模型', value: ModalKinds.Cloud },
                { label: '本地模型', value: ModalKinds.Local },
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="自定义名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如: GPT-4o" />
          </Form.Item>
          <Form.Item name="modelName" label="模型名" rules={[{ required: true, message: '请输入模型名' }]}>
            <Input placeholder="例如: gpt-4o" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
          <Form.Item name="url" label="API URL">
            <Input placeholder="例如: https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key">
            <Input.Password placeholder="留空或输入密钥" />
          </Form.Item>
          <Space>
            <Form.Item name={['token', 'min']} label="最小 Token">
              <InputNumber min={0} max={128000} style={{ width: 120 }} />
            </Form.Item>
            <span>~</span>
            <Form.Item name={['token', 'max']} label="最大 Token">
              <InputNumber min={0} max={128000} style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
