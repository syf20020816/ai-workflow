import { useNodeStore } from '#/store/node'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
} from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { Button } from 'antd'
import { CircleX, ClosedCaptionIcon } from 'lucide-react'

export const NodeEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) => {
  //   const { setEdges } = useReactFlow()
  const removeEdge = useNodeStore((state) => state.removeEdge)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <CircleX
          size={10}
          color="#ea1919ff"
          onClick={() => {
            removeEdge(id)
          }}

          style={{
            transform: `translate(-50%, -100%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'auto',
            zIndex: 100,
          }}
        />
      </EdgeLabelRenderer>
    </>
  )
}
