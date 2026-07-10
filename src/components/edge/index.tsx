import { useNodeStore } from '#/store/node'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { CircleX } from 'lucide-react'

export const NodeEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) => {
  const removeEdge = useNodeStore((state) => state.removeEdge)
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  // 手动计算中点：直接用 source/target 的平均值
  // getBezierPath 返回的 labelX/labelY 受控制点影响，非对称路径下会偏离视觉中心
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            left: midX,
            top: midY,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            zIndex: 100,
            lineHeight: 0,
          }}
        >
          <CircleX
            size={10}
            color="#ea1919ff"
            onClick={() => {
              removeEdge(id)
            }}
            style={{ cursor: 'pointer' }}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
