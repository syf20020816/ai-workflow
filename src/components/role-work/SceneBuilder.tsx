import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Tabs, Tooltip, message } from 'antd'
import {
  Eraser,
  FolderOpen,
  MousePointer2,
  Save,
  SquareDashed,
  User,
  Grid3x3,
} from 'lucide-react'
import { ASSETS } from './assets'
import { useRoleWorkStore } from './store'
import type { Rect } from './store'
import styles from './index.module.scss'

/** 源图原始尺寸（floor.png / office_suite.png 均为 2848×1600） */
const SRC_W = 2848
const SRC_H = 1600
/** 素材预览图高度（像素），按比例缩放 */
const PREVIEW_H = 96

type EditorTab = 'floor' | 'item' | 'role'

interface DragState {
  startX: number
  startY: number
  endX: number
  endY: number
}

/**
 * 共享的拖拽框选钩子：在源图预览上拖拽选择一个矩形区域。
 * 返回当前选区（原图像素坐标）与拖拽事件处理器。
 */
function useDragSelect() {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [selected, setSelected] = useState<Rect | null>(null)

  const scale = PREVIEW_H / SRC_H
  const previewW = SRC_W * scale

  const toOriginal = useCallback((clientX: number, clientY: number) => {
    const wrap = wrapRef.current
    if (!wrap) return { x: 0, y: 0 }
    const rect = wrap.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * SRC_W
    const y = ((clientY - rect.top) / rect.height) * SRC_H
    return {
      x: Math.max(0, Math.min(SRC_W, Math.round(x))),
      y: Math.max(0, Math.min(SRC_H, Math.round(y))),
    }
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    const p = toOriginal(e.clientX, e.clientY)
    setDrag({ startX: p.x, startY: p.y, endX: p.x, endY: p.y })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return
    const p = toOriginal(e.clientX, e.clientY)
    setDrag({ ...drag, endX: p.x, endY: p.y })
  }
  const onMouseUp = () => {
    if (!drag) return
    const x = Math.min(drag.startX, drag.endX)
    const y = Math.min(drag.startY, drag.endY)
    const w = Math.abs(drag.endX - drag.startX)
    const h = Math.abs(drag.endY - drag.startY)
    setDrag(null)
    if (w < 16 || h < 16) return
    const rect: Rect = { x, y, width: w, height: h }
    setSelected(rect)
    return rect
  }

  /** 选区 overlay（预览图坐标） */
  const overlay = (() => {
    if (drag) {
      return {
        x: Math.min(drag.startX, drag.endX) * scale,
        y: Math.min(drag.startY, drag.endY) * scale,
        w: Math.abs(drag.endX - drag.startX) * scale,
        h: Math.abs(drag.endY - drag.startY) * scale,
      }
    }
    if (selected) {
      return {
        x: selected.x * scale,
        y: selected.y * scale,
        w: selected.width * scale,
        h: selected.height * scale,
      }
    }
    return null
  })()

  return { wrapRef, drag, selected, setSelected, scale, previewW, onMouseDown, onMouseMove, onMouseUp, overlay }
}

/** 源图预览 + 拖拽框选组件 */
function SourcePicker({
  imgSrc,
  wrapRef,
  previewW,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  overlay,
}: {
  imgSrc: string
  wrapRef: React.RefObject<HTMLDivElement | null>
  previewW: number
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  overlay: { x: number; y: number; w: number; h: number } | null
}) {
  return (
    <div
      ref={wrapRef}
      className={styles.suiteWrap}
      style={{ width: previewW, height: PREVIEW_H }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <img src={imgSrc} alt="source" draggable={false} />
      {overlay && (
        <div
          className={styles.suiteSelect}
          style={{ left: overlay.x, top: overlay.y, width: overlay.w, height: overlay.h }}
        />
      )}
    </div>
  )
}

/**
 * 场景搭建器（游戏编辑器式 Tab）：
 * - 地板：从 floor.png 框选区域，点击画布按网格铺设
 * - 物品：从 office_suite.png 框选区域，点击画布自由放置
 * - 人物：选择已创建角色，点击画布放置
 * 右侧工具栏：选择模式、清空、保存、加载
 */
export const SceneBuilder = () => {
  const brush = useRoleWorkStore((s) => s.brush)
  const setBrush = useRoleWorkStore((s) => s.setBrush)
  const sceneItems = useRoleWorkStore((s) => s.sceneItems)
  const floorTiles = useRoleWorkStore((s) => s.floorTiles)
  const roles = useRoleWorkStore((s) => s.roles)
  const clearSceneItems = useRoleWorkStore((s) => s.clearSceneItems)
  const clearFloorTiles = useRoleWorkStore((s) => s.clearFloorTiles)
  const saveScene = useRoleWorkStore((s) => s.saveScene)
  const loadScene = useRoleWorkStore((s) => s.loadScene)
  const hasSavedScene = useRoleWorkStore((s) => s.hasSavedScene)

  const [activeTab, setActiveTab] = useState<EditorTab>('floor')
  const [hasSaved, setHasSaved] = useState(false)

  // 地板和物品各自独立的拖拽状态
  const floorPicker = useDragSelect()
  const itemPicker = useDragSelect()

  useEffect(() => {
    setHasSaved(hasSavedScene())
  }, [hasSavedScene])

  // 切换 Tab 时清除画笔
  const handleTabChange = (key: string) => {
    setBrush(null)
    setActiveTab(key as EditorTab)
  }

  // 选中地板区域后自动激活画笔
  const handleFloorMouseUp = () => {
    const rect = floorPicker.onMouseUp()
    if (rect) setBrush({ type: 'floor', rect })
  }

  // 选中物品区域后自动激活画笔
  const handleItemMouseUp = () => {
    const rect = itemPicker.onMouseUp()
    if (rect) setBrush({ type: 'item', rect })
  }

  const handleSave = () => {
    saveScene()
    setHasSaved(true)
    message.success('场景已保存')
  }

  const handleLoad = () => {
    if (loadScene()) {
      message.success('场景已加载')
    } else {
      message.warning('没有已保存的场景')
    }
  }

  const handleClearAll = () => {
    clearSceneItems()
    clearFloorTiles()
    setBrush(null)
  }

  const hint = (() => {
    if (!brush) return '选择素材后点击画布放置'
    switch (brush.type) {
      case 'floor':
        return '点击画布铺设地板（吸附网格）'
      case 'item':
        return '点击画布放置物品'
      case 'role':
        return '点击画布放置角色'
    }
  })()

  const tabItems = [
    {
      key: 'floor',
      label: (
        <span className={styles.tabLabel}>
          <Grid3x3 size={13} />
          地板
        </span>
      ),
      children: (
        <SourcePicker
          imgSrc={ASSETS.floor}
          wrapRef={floorPicker.wrapRef}
          previewW={floorPicker.previewW}
          onMouseDown={floorPicker.onMouseDown}
          onMouseMove={floorPicker.onMouseMove}
          onMouseUp={handleFloorMouseUp}
          overlay={floorPicker.overlay}
        />
      ),
    },
    {
      key: 'item',
      label: (
        <span className={styles.tabLabel}>
          <SquareDashed size={13} />
          物品
        </span>
      ),
      children: (
        <SourcePicker
          imgSrc={ASSETS.officeSuite}
          wrapRef={itemPicker.wrapRef}
          previewW={itemPicker.previewW}
          onMouseDown={itemPicker.onMouseDown}
          onMouseMove={itemPicker.onMouseMove}
          onMouseUp={handleItemMouseUp}
          overlay={itemPicker.overlay}
        />
      ),
    },
    {
      key: 'role',
      label: (
        <span className={styles.tabLabel}>
          <User size={13} />
          人物
        </span>
      ),
      children: (
        <div className={styles.rolePalette}>
          {roles.length === 0 ? (
            <span className={styles.rolePaletteEmpty}>暂无角色，请先创建</span>
          ) : (
            roles.map((role) => {
              const isActive = brush?.type === 'role' && brush.roleId === role.id
              return (
                <Button
                  key={role.id}
                  size="small"
                  type={isActive ? 'primary' : 'default'}
                  className={styles.rolePaletteChip}
                  onClick={() => {
                    if (isActive) {
                      setBrush(null)
                    } else {
                      setBrush({ type: 'role', roleId: role.id })
                    }
                  }}
                >
                  {role.name}
                </Button>
              )
            })
          )}
        </div>
      ),
    },
  ]

  return (
    <div className={styles.sceneBuilder}>
      <div className={styles.sceneTabs}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          size="small"
          tabBarStyle={{ margin: 0 }}
        />
      </div>

      <div className={styles.sceneToolbar}>
        <Tooltip title="选择模式（点击角色私聊/拖拽角色）">
          <Button
            size="small"
            type={!brush ? 'primary' : 'default'}
            icon={<MousePointer2 size={14} />}
            onClick={() => setBrush(null)}
          />
        </Tooltip>
        <Tooltip title="清空场景（地板+物品）">
          <Button
            size="small"
            danger
            icon={<Eraser size={14} />}
            onClick={handleClearAll}
            disabled={sceneItems.length === 0 && floorTiles.length === 0}
          />
        </Tooltip>
        <Tooltip title="保存场景">
          <Button size="small" icon={<Save size={14} />} onClick={handleSave} />
        </Tooltip>
        <Tooltip title="加载已保存的场景">
          <Button
            size="small"
            icon={<FolderOpen size={14} />}
            onClick={handleLoad}
            disabled={!hasSaved}
          />
        </Tooltip>
        <div className={styles.sceneStats}>
          <span>地板 {floorTiles.length}</span>
          <span>物品 {sceneItems.length}</span>
        </div>
        <span className={styles.sceneHint}>{hint}</span>
      </div>
    </div>
  )
}
