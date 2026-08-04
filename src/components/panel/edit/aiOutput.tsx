import { useNodeStore } from '#/store/node'
import type { NAIOutput, NAIOutputData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { DynEditKV } from './item'
import type { DynEditKVRow } from './item'
import styles from '../index.module.scss'
import { Typography } from 'antd'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NAIOutputData

export const EditAIOutput = () => {
  const currentNode = useNodeStore(
    (state) => state.currentNode,
  ) as NodeProps<NAIOutput>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  const rows: DynEditKVRow[] = [
    {
      key: 'outputPath',
      label: '导出文件路径',
      value: currentNode.data.outputPath,
      placeholder: '/Users/xxx/Desktop/output.md',
    },
  ]

  return (
    <>
      <DynEditKV
        rows={rows}
        onChange={(key, value) => {
          patchCurrentNode((draft) => {
            ;(d(draft) as Record<string, any>)[key] = (value as string) || ''
          })
        }}
      />
      <div className={styles.line}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          配置后，节点执行时将自动把上游输出内容写入该文件
        </Text>
      </div>
    </>
  )
}
