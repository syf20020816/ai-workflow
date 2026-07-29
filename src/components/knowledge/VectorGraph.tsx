import { useRef, useEffect, useCallback, useState } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
} from 'd3-force'
import { Spin, Typography, Empty, Space, Slider, Tag } from 'antd'
import { ReloadOutlined, ZoomInOutlined } from '@ant-design/icons'

const { Text } = Typography

interface GraphNode {
  id: string
  label: string   // 例: "需求文档.md #3"
  source: string  // 来源文件名（用于分组着色）
  x: number
  y: number
  vx: number
  vy: number
  degree: number
  colorIndex: number
  snippet: string  // 文本内容摘要
}

interface GraphLink {
  source: string
  target: string
  strength: number
}

interface VectorGraphProps {
  collectionName: string
}

const SIMULATION_ITERATIONS = 150

/** 余弦相似度 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb)
  return mag === 0 ? 0 : dot / mag
}

const COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#ff99cc',
  '#69c0ff', '#b37feb',
]

/** 缩短长名称: workflow-18679fbe...f06 #3 */
function shortenLabel(source: string, chunkIndex: number): string {
  const idx = ` #${chunkIndex}`
  // 对 UUID 或长 hash 截断: 首3尾3
  if (source.length > 20) {
    const trimmed = source.slice(0, 3) + '...' + source.slice(-3)
    return trimmed + idx
  }
  return source + idx
}

export const VectorGraph = ({ collectionName }: VectorGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pointCount, setPointCount] = useState(0)
  const [similarityThreshold, setSimilarityThreshold] = useState(0.6)
  const [zoom, setZoom] = useState(1)
  const [sourceColors, setSourceColors] = useState<Array<{ source: string; color: string }>>([])
  const [hoverInfo, setHoverInfo] = useState<{ text: string; x: number; y: number } | null>(null)

  const viewRef = useRef({ zoom: 1, offsetX: 0, offsetY: 0 })
  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const hoveredRef = useRef<GraphNode | null>(null)
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; startOffX: number; startOffY: number } | null>(null)
  const animationIdRef = useRef<number>(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/execute/qdrant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scroll', collectionName, maxPoints: 500 }),
      })
      const data = await res.json()
      if (data.status !== 'success') {
        setError(data.error || '读取数据失败')
        return
      }
      const points: any[] = data.output?.points || []
      if (points.length === 0) {
        setError('集合中无数据')
        return
      }
      setPointCount(points.length)

      const vectors = points.map((p) => p.vector)

      // 按 source 分组着色
      const sourceMap = new Map<string, number>()
      for (const p of points) {
        const src = p.payload?.source || 'unknown'
        if (!sourceMap.has(src)) sourceMap.set(src, sourceMap.size)
      }
      const srcColors = Array.from(sourceMap.entries()).map(([source, idx]) => ({
        source,
        color: COLORS[idx % COLORS.length],
      }))
      setSourceColors(srcColors)

      // 构建节点
      const nodes: GraphNode[] = []
      const nodeMap = new Map<string, number>()
      const degrees = new Array(points.length).fill(0)
      const links: GraphLink[] = []

      for (let i = 0; i < points.length; i++) {
        const id = String(points[i].id)
        const payload = points[i].payload || {}
        const source = payload.source || 'unknown'
        const chunkIndex = payload.chunk_index ?? i
        const colorIdx = sourceMap.get(source) ?? 0
        const snippet = payload.content || JSON.stringify(payload)
        const snippetStr = typeof snippet === 'string' ? snippet : JSON.stringify(snippet)

        nodes.push({
          id,
          label: shortenLabel(source, chunkIndex),
          source,
          x: Math.random() * 800,
          y: Math.random() * 600,
          vx: 0, vy: 0,
          degree: 0,
          colorIndex: colorIdx,
          snippet: snippetStr.length > 120 ? snippetStr.slice(0, 120) + '...' : snippetStr,
        })
        nodeMap.set(id, i)
      }

      // 计算边（基于余弦相似度）
      const threshold = similarityThreshold
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const sim = cosineSimilarity(vectors[i], vectors[j])
          if (sim > threshold) {
            links.push({ source: nodes[i].id, target: nodes[j].id, strength: Math.round(sim * 100) / 100 })
            degrees[i]++
            degrees[j]++
          }
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        nodes[i].degree = degrees[i]
      }

      nodesRef.current = nodes
      linksRef.current = links

      // 力导向仿真
      const sim = forceSimulation(nodes)
        .force('link', forceLink(links).id((d: any) => d.id).distance(80))
        .force('charge', forceManyBody().strength(-150))
        .force('center', forceCenter(400, 300))
        .alphaDecay(0.025)
      for (let i = 0; i < SIMULATION_ITERATIONS; i++) sim.tick()
      sim.stop()

      // 适配缩放
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const n of nodes) {
        if (n.x < minX) minX = n.x
        if (n.y < minY) minY = n.y
        if (n.x > maxX) maxX = n.x
        if (n.y > maxY) maxY = n.y
      }
      const graphWidth = maxX - minX || 1
      const graphHeight = maxY - minY || 1
      const canvas = canvasRef.current
      if (canvas) {
        const cw = canvas.width
        const ch = canvas.height
        const fitScale = Math.min(cw / (graphWidth + 100), ch / (graphHeight + 100), 2) * 0.9
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        viewRef.current = {
          zoom: fitScale,
          offsetX: cw / 2 - cx * fitScale,
          offsetY: ch / 2 - cy * fitScale,
        }
        setZoom(fitScale)
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || '加载数据失败')
      setLoading(false)
    }
  }, [collectionName, similarityThreshold])

  useEffect(() => {
    if (collectionName) loadData()
  }, [collectionName, loadData])

  // 绘制画布
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const { zoom: z, offsetX, offsetY } = viewRef.current
    ctx.scale(dpr * z, dpr * z)
    ctx.translate(offsetX / z, offsetY / z)

    const nodes = nodesRef.current
    const links = linksRef.current
    const hovered = hoveredRef.current
    const maxDeg = Math.max(...nodes.map((n) => n.degree), 1)

    // 画边
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 0.5
    for (const link of links) {
      const src = typeof link.source === 'object' ? link.source : nodes.find((n) => n.id === link.source)
      const tgt = typeof link.target === 'object' ? link.target : nodes.find((n) => n.id === link.target)
      if (!src || !tgt) continue
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.stroke()
    }

    // 画节点
    for (const node of nodes) {
      const r = 4 + (node.degree / Math.max(maxDeg, 1)) * 10
      const color = COLORS[node.colorIndex % COLORS.length]

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = node === hovered ? 1 : 0.75
      ctx.fill()
      ctx.globalAlpha = 1

      if (node === hovered) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // 高 degree 或 hovered 节点显示标签
      if (node.degree > maxDeg * 0.3 || node === hovered) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(node.label, node.x, node.y + r + 14)
      }
    }

    // hovered tooltip（显示文本内容）
    if (hovered) {
      const lines = [`📄 ${hovered.label} (连接: ${hovered.degree})`]
      // 插入文本摘要
      const snippet = hovered.snippet
      if (snippet) {
        // 按宽度换行
        const maxCharsPerLine = Math.max(20, Math.floor(30 / z))
        for (let i = 0; i < snippet.length; i += maxCharsPerLine) {
          lines.push(snippet.slice(i, i + maxCharsPerLine))
        }
      }

      const lineHeight = 16
      const pad = 8
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width))
      const tw = maxLineW + pad * 2
      const th = lines.length * lineHeight + pad * 2
      let tx = hovered.x + 16
      let ty = hovered.y - th / 2

      // 确保不超出画布
      const canvasW = w / (dpr * z) - offsetX / z
      const canvasH = h / (dpr * z) - offsetY / z
      if (tx + tw > canvasW) tx = hovered.x - tw - 16
      if (ty < 0) ty = 4
      if (ty + th > canvasH) ty = canvasH - th - 4

      ctx.fillStyle = 'rgba(0,0,0,0.85)'
      ctx.beginPath()
      ctx.roundRect(tx, ty, tw, th, 6)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'left'
      for (let i = 0; i < lines.length; i++) {
        ctx.fillStyle = i === 0 ? '#ffd666' : '#fff'
        ctx.fillText(lines[i], tx + pad, ty + pad + (i + 1) * lineHeight - 4)
      }
    }
  }, [])

  // 动画循环
  useEffect(() => {
    let id = requestAnimationFrame(function tick() {
      draw()
      id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [draw])

  // 鼠标移动（碰撞检测 + tooltip）
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { zoom: z, offsetX, offsetY } = viewRef.current
    const mx = (e.clientX - rect.left) / z - offsetX / z
    const my = (e.clientY - rect.top) / z - offsetY / z

    const nodes = nodesRef.current
    const maxDeg = Math.max(...nodes.map((n) => n.degree), 1)
    let found: GraphNode | null = null
    for (const node of nodes) {
      const r = 4 + (node.degree / Math.max(maxDeg, 1)) * 10
      const dx = mx - node.x
      const dy = my - node.y
      if (dx * dx + dy * dy <= r * r) {
        found = node
        break
      }
    }
    if (found !== hoveredRef.current) {
      hoveredRef.current = found
      canvas.style.cursor = found ? 'pointer' : 'default'
      if (found) {
        setHoverInfo({ text: found.snippet, x: e.clientX, y: e.clientY })
      } else {
        setHoverInfo(null)
      }
    }
  }, [])

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const v = viewRef.current
    const newZoom = Math.max(0.1, Math.min(10, v.zoom * delta))
    v.offsetX = mx - (mx - v.offsetX) * (newZoom / v.zoom)
    v.offsetY = my - (my - v.offsetY) * (newZoom / v.zoom)
    v.zoom = newZoom
    setZoom(newZoom)
  }, [])

  // 拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredRef.current) return
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffX: viewRef.current.offsetX,
      startOffY: viewRef.current.offsetY,
    }
  }, [])

  useEffect(() => {
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      const ds = dragState.current
      if (!ds) return
      viewRef.current.offsetX = ds.startOffX + (e.clientX - ds.startX)
      viewRef.current.offsetY = ds.startOffY + (e.clientY - ds.startY)
      setHoverInfo(null)
    }
    const handleMouseUpGlobal = () => { dragState.current = null }
    window.addEventListener('mousemove', handleMouseMoveGlobal)
    window.addEventListener('mouseup', handleMouseUpGlobal)
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal)
      window.removeEventListener('mouseup', handleMouseUpGlobal)
    }
  }, [])

  if (!collectionName) return <Empty description="请先选择集合" />

  return (
    <div>
      {/* 控制栏 */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Text strong>集合: {collectionName}</Text>
          {pointCount > 0 && <Text type="secondary">{pointCount} 个向量点</Text>}
          {/* 颜色图例 */}
          {sourceColors.map((sc) => (
            <Tag key={sc.source} color={sc.color} style={{ fontSize: 11 }}>
              {shortenLabel(sc.source, 3)}
            </Tag>
          ))}
        </Space>
        <Space size="middle">
          <Space size={4}>
            <ZoomInOutlined style={{ fontSize: 12, color: '#888' }} />
            <Slider min={0.1} max={2} step={0.05} value={zoom}
              onChange={(v) => { viewRef.current.zoom = v; setZoom(v) }}
              style={{ width: 100 }}
            />
          </Space>
          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>相似度</Text>
            <Slider min={0.1} max={0.95} step={0.05} value={similarityThreshold}
              onChange={setSimilarityThreshold}
              style={{ width: 100 }}
            />
          </Space>
          <ReloadOutlined style={{ cursor: 'pointer', color: '#888' }} onClick={loadData} />
        </Space>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin tip="加载向量数据..." /></div>
      ) : error ? (
        <Empty description={error} />
      ) : (
        <div ref={containerRef} style={{
          width: '100%', height: 'calc(100vh - 340px)', minHeight: 400,
          background: '#141414', borderRadius: 8, overflow: 'hidden', position: 'relative',
        }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseUp={() => { dragState.current = null }}
            onMouseLeave={() => { hoveredRef.current = null; setHoverInfo(null); dragState.current = null }}
          />
        </div>
      )}
    </div>
  )
}
