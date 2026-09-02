import { useModelStore } from '#/store/model'
import type { Model } from '#/types/model'
import { fetchLocalTools } from '#/services/runner'
import { Select } from 'antd'
import type { SelectProps } from 'antd'
import { useEffect, useState } from 'react'

// Omit<SelectProps, 'onChange'>：排除父接口的 onChange，避免与自定义签名（第二参为 Model[]）类型冲突
export interface ModelSelectProps extends Omit<SelectProps, 'onChange'> {
  onChange?: (value: string, models: Model[]) => void
}

export const ModelSelect = ({ value, onChange, ...rest }: ModelSelectProps) => {
  const models = useModelStore((state) => state.models)
  const fetchModels = useModelStore((state) => state.fetchModels)

  useEffect(() => {
    fetchModels()
  }, [])

  return (
    <Select
      placeholder="选择模型..."
      value={value}
      notFoundContent="暂无模型，请先添加"
      options={models.map((m) => ({
        label: `${m.name} (${m.modelName})`,
        value: m.name,
      }))}
      onChange={(v) => onChange?.(v, models)}
      {...rest}
    />
  )
}

/** 本地 CLI 工具选择器：列表来自 Runner 对本机的探测（claude/codex/deepseek 等） */
export const ToolSelect = ({
  value,
  onChange,
  ...rest
}: Omit<SelectProps, 'onChange'> & {
  onChange?: (value: string) => void
}) => {
  const [tools, setTools] = useState<{ id: string; name: string; available: boolean }[]>([])

  useEffect(() => {
    fetchLocalTools().then(setTools)
  }, [])

  return (
    <Select
      allowClear
      placeholder="选择本地工具..."
      value={value}
      notFoundContent="Runner 未启动或本机无可用 CLI 工具"
      options={tools.map((t) => ({
        label: t.available ? t.name : `${t.name}（未安装）`,
        value: t.id,
        disabled: !t.available,
      }))}
      onChange={(v) => onChange?.(v)}
      {...rest}
    />
  )
}
