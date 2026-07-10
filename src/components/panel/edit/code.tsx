import { useNodeStore } from '#/store/node'
import type { NCode, NCodeData } from '#/types'
import type { NodeProps } from '@xyflow/react'
import { EditItem } from './item'
import { Select, Typography } from 'antd'

const { Text } = Typography

const d = (
  draft: NonNullable<ReturnType<typeof useNodeStore.getState>['currentNode']>,
) => draft.data as NCodeData

export const EditCode = () => {
  const currentNode = useNodeStore((state) => state.currentNode) as NodeProps<NCode>
  const patchCurrentNode = useNodeStore((state) => state.patchCurrentNode)

  return (
    <>
      <div className="line">
        <Text>运行模式</Text>
        <Select
          style={{ width: '100%' }}
          value={currentNode.data.mode}
          options={[
            { label: '本地', value: 'local' },
            { label: '云端', value: 'cloud' },
          ]}
          onChange={(v) => {
            patchCurrentNode((draft) => {
              d(draft).mode = v
            })
          }}
        />
      </div>

      <EditItem
        label="仓库 URL"
        placeholder="如：https://github.com/user/repo.git 或 /path/to/local/repo"
        value={currentNode.data.repoUrl}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).repoUrl = (v || '') as string
          })
        }}
      />

      <EditItem
        label="分支"
        placeholder="默认: master"
        value={currentNode.data.branch}
        onChange={(v) => {
          patchCurrentNode((draft) => {
            d(draft).branch = (v || 'master') as string
          })
        }}
      />
    </>
  )
}
