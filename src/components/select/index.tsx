import { useModelStore } from '#/store/model'
import type { Model } from '#/types/model'
import { Select } from 'antd'
import type { SelectProps } from 'antd'
import { useEffect } from 'react'

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
