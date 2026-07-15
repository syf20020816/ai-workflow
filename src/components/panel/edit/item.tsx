import React from 'react'
import { InputKinds } from '#/types'
import type { InputKind } from '#/types'
import {
  TextIcon,
  CrumpledPaperIcon,
  FileTextIcon,
  Link1Icon,
  CrossCircledIcon,
} from '@radix-ui/react-icons'
import styles from '../index.module.scss'
import {
  Button,
  Input,
  InputNumber,
  Typography,
  Modal,
  Tree,
  type TableProps,
  Table,
} from 'antd'
import type { ReactNode, Key } from 'react'
import { useNodeStore } from '#/store/node'
import { getPredecessors } from '#/engine/topological'
import { Plus } from 'lucide-react'

const { Text } = Typography

export interface EditItemProps {
  /** 字段标签 */
  label?: string
  /** 占位符（当使用 kind 时自动派生默认值） */
  placeholder?: string
  /** 输入值 */
  value?: string | number | File
  /** 值变更回调 */
  onChange?: (value: string | number | undefined) => void
  /** 删除回调 */
  onDelete?: () => void
  /** 输入控件类型 */
  inputType?: 'text' | 'textArea' | 'password' | 'number'
  /** 只读 */
  readOnly?: boolean
  /** textArea 行数 */
  rows?: number
  /** number 最小值 */
  min?: number
  /** number 最大值 */
  max?: number
  /** number 步长 */
  step?: number
  /** 是否显示获取按钮（从上游节点获取数据） */
  showPickButton?: boolean

  // ---- 以下为 InputKinds 兼容模式 ----
  /** 输入种类（兼容旧用法，设置后自动派生 label/placeholder/icon） */
  kind?: InputKind
}

const iconAttrs = {
  width: 12,
  height: 12,
  color: '#1890ff',
}

const EditTextMapper = new Map<
  InputKind,
  {
    label: string
    placeholder: string
    icon: ReactNode
  }
>([
  [
    InputKinds.text,
    {
      label: '用户文本输入',
      placeholder: '输入用户文本',
      icon: <TextIcon {...iconAttrs} />,
    },
  ],
  [
    InputKinds.prompt,
    {
      label: '提示词',
      placeholder: '输入提示词',
      icon: <CrumpledPaperIcon {...iconAttrs} />,
    },
  ],
  [
    InputKinds.file,
    {
      label: '文件',
      placeholder: '上传文件',
      icon: <FileTextIcon {...iconAttrs} />,
    },
  ],
  [
    InputKinds.url,
    {
      label: '链接',
      placeholder: '输入链接',
      icon: <Link1Icon {...iconAttrs} />,
    },
  ],
])

function buildTree(
  data: Record<string, any>,
  prefix: string = '',
): { key: Key; title: string; children?: any[] }[] {
  const result: { key: Key; title: string; children?: any[] }[] = []
  for (const [key, val] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (val === null || val === undefined) {
      result.push({ key: fullKey, title: `${key}: ${val}` })
    } else if (typeof val === 'object') {
      const children = buildTree(val, fullKey)
      result.push({
        key: fullKey,
        title: `${key}`,
        children: children.length > 0 ? children : undefined,
      })
    } else {
      result.push({ key: fullKey, title: `${key}: ${val}` })
    }
  }
  return result
}

export interface DynEditKVRow {
  key: string
  label: string
  value?: string | number | File
  inputType?: 'text' | 'textArea' | 'password' | 'number'
  placeholder?: string
  rows?: number
  min?: number
  max?: number
  step?: number
  readOnly?: boolean
  /** 自定义值渲染，覆盖默认的 EditItem */
  valueRender?: (onChange: (v: any) => void) => React.ReactNode
  /** 自定义操作按钮，覆盖默认的获取上游数据按钮 */
  actionRender?: React.ReactNode
  /** 删除回调 */
  onDelete?: () => void
}

export interface DynEditKVProps {
  rows: DynEditKVRow[]
  onChange: (key: string, value: any) => void
  /** 缺少上游数据时的提示 */
  emptyText?: string
}

export const DynEditKV = ({ rows, onChange, emptyText }: DynEditKVProps) => {
  const currentNode = useNodeStore((state) => state.currentNode)
  const nodes = useNodeStore((state) => state.nodes)
  const edges = useNodeStore((state) => state.edges)
  const [modalVisible, setModalVisible] = React.useState(false)

  const predecessors = currentNode ? getPredecessors(currentNode.id, edges) : []

  const treeData = React.useMemo(() => {
    const result: { key: Key; title: string; children?: any[] }[] = []
    for (const predId of predecessors) {
      const node = nodes.find((n) => n.id === predId)
      if (node) {
        const nodeTitle = node.data.title || predId
        const children = buildTree(node.data, predId)
        result.push({
          key: predId,
          title: `${nodeTitle} (${predId})`,
          children: children.length > 0 ? children : undefined,
        })
      }
    }
    return result
  }, [predecessors, nodes])

  const handlePick = (keys: Key[], rowKey: string) => {
    if (keys.length > 0) {
      const selectedKey = keys[0] as string
      const [nodeId, ...pathParts] = selectedKey.split('.')
      const node = nodes.find((n) => n.id === nodeId)
      if (node) {
        let current: any = node.data
        for (const part of pathParts) {
          current = current?.[part]
        }
        if (current !== undefined && current !== null) {
          onChange(
            rowKey,
            typeof current === 'string' ? current : JSON.stringify(current),
          )
        }
      }
    }
    setModalVisible(false)
  }

  const columns: TableProps<DynEditKVRow>['columns'] = [
    {
      title: '键',
      dataIndex: 'label',
      key: 'label',
      width: 80,
      render: (text) => <strong style={{ fontSize: 12 }}>{text}</strong>,
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (_, record) => {
        if (record.valueRender) {
          return record.valueRender((v: any) => onChange(record.key, v))
        }
        return (
          <EditItem
            inputType={record.inputType}
            placeholder={record.placeholder}
            rows={record.rows}
            min={record.min}
            max={record.max}
            step={record.step}
            readOnly={record.readOnly}
            value={record.value}
            onChange={(v) => onChange(record.key, v)}
          />
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => {
        if (record.actionRender !== undefined) {
          return record.actionRender
        }
        if (record.readOnly) return null
        return (
          <div style={{ display: 'flex', gap: 2 }}>
            {record.onDelete && (
              <Button
                type="text"
                size="small"
                danger
                icon={<CrossCircledIcon width={12} height={12} />}
                onClick={(e) => {
                  e.stopPropagation()
                  record.onDelete?.()
                }}
              />
            )}
            {predecessors.length > 0 ? (
              <Button
                type="text"
                size="small"
                icon={<Plus width={12} height={12} />}
                onClick={(e) => {
                  e.stopPropagation()
                  setPickTargetKey(record.key)
                  setModalVisible(true)
                }}
              />
            ) : null}
          </div>
        )
      },
    },
  ]

  const [pickTargetKey, setPickTargetKey] = React.useState<string | null>(null)

  return (
    <>
      <Table<DynEditKVRow>
        columns={columns}
        dataSource={rows}
        rowKey="key"
        pagination={false}
        showHeader={true}
        size="small"
        bordered
        styles={{root: {marginTop: 8}}}
      />
      <Modal
        title="选择上游数据"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setPickTargetKey(null) }}
        footer={null}
        width={600}
        styles={{
          body: { overflow: 'auto', scrollbarWidth: 'thin' },
        }}
      >
        {treeData.length > 0 ? (
          <Tree
            treeData={treeData}
            defaultExpandAll
            showLine
            onSelect={(keys) => pickTargetKey && handlePick(keys, pickTargetKey)}
          />
        ) : (
          <Text type="secondary">{emptyText || '暂无上游节点，请先连接上游节点'}</Text>
        )}
      </Modal>
    </>
  )
}

export const EditItem = ({
  label: explicitLabel,
  placeholder: explicitPlaceholder,
  value,
  onChange,
  onDelete,
  inputType = 'text',
  readOnly,
  rows = 3,
  min,
  max,
  step,
  kind,
}: EditItemProps) => {
  const kindMeta = kind ? EditTextMapper.get(kind) : undefined
  const label = explicitLabel ?? kindMeta?.label ?? ''
  const placeholder = explicitPlaceholder ?? kindMeta?.placeholder ?? ''
  const prefix = kindMeta?.icon

  return (
    <div className={styles.line}>
      <div className={styles.line_row}>
        <Text>{label}</Text>
        {onDelete && (
          <Button
            type="text"
            size="small"
            danger
            icon={<CrossCircledIcon />}
            onClick={onDelete}
          />
        )}
      </div>
      {inputType === 'textArea' ? (
        <div style={{ display: 'flex', gap: 4, width: '100%' }}>
          <Input.TextArea
            rows={rows}
            value={value as string}
            placeholder={placeholder}
            readOnly={readOnly}
            onChange={(e) => onChange?.(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      ) : inputType === 'password' ? (
        <Input.Password
          prefix={prefix}
          value={value as string}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : inputType === 'number' ? (
        <InputNumber
          style={{ width: '100%' }}
          min={min}
          max={max}
          step={step}
          value={value as number}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(v) => onChange?.(v ?? undefined)}
        />
      ) : (
        <Input
          prefix={prefix}
          value={value as string}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  )
}
