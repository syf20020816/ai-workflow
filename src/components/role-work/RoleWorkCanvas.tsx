import { useCallback, useEffect, useRef } from 'react'
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import { ASSETS } from './assets'
import { useRoleWorkStore } from './store'
import type { Rect, Role, RoleStatus } from './store'
import styles from './index.module.scss'

/** 场景坐标系尺寸 */
const SCENE_W = 2848
const SCENE_H = 1600

const STATUS_COLOR: Record<RoleStatus, number> = {
  idle: 0x8c8c8c,
  working: 0x1890ff,
  thinking: 0x722ed1,
  success: 0x52c41a,
  error: 0xff4d4f,
}

const STATUS_LABEL: Record<RoleStatus, string> = {
  idle: 'IDLE',
  working: 'WORKING',
  thinking: 'THINKING',
  success: 'DONE',
  error: 'ERROR',
}

/** 将可序列化 Rect 转为 Pixi Rectangle */
function toPixiRect(r: Rect): Rectangle {
  return new Rectangle(r.x, r.y, r.width, r.height)
}

/**
 * 构建单个角色的 Pixi 容器：选中描边 + 圆形身体 + 首字母 + 名字 + 状态气泡。
 * 选择模式下可拖拽，点击触发私聊。
 */
function createRoleContainer(
  role: Role,
  x: number,
  y: number,
  selected: boolean,
  onDragEnd: (id: string, x: number, y: number) => void,
) {
  const c = new Container()
  c.x = x
  c.y = y
  c.zIndex = selected ? 10 : 1
  c.eventMode = 'static'
  c.hitArea = new Rectangle(-24, -24, 48, 48)
  c.cursor = 'pointer'

  let dragging = false
  let dragOffset = { x: 0, y: 0 }

  c.on('pointerdown', (e: FederatedPointerEvent) => {
    if (useRoleWorkStore.getState().brush !== null) return
    dragging = true
    dragOffset = { x: e.global.x - c.x, y: e.global.y - c.y }
    c.zIndex = 20
    e.stopPropagation()
  })
  c.on('globalpointermove', (e: FederatedPointerEvent) => {
    if (!dragging) return
    const local = c.parent?.toLocal(e.global)
    if (!local) return
    c.x = local.x - dragOffset.x
    c.y = local.y - dragOffset.y
  })
  c.on('pointerup', () => {
    if (!dragging) return
    dragging = false
    c.zIndex = selected ? 10 : 1
    onDragEnd(role.id, c.x, c.y)
  })
  c.on('pointertap', (e: FederatedPointerEvent) => {
    e.stopPropagation()
    useRoleWorkStore.getState().selectRole(role.id)
    useRoleWorkStore.getState().setChatMode('private')
    useRoleWorkStore.getState().setActivePrivateRole(role.id)
  })

  if (selected) {
    const ring = new Graphics()
    ring.circle(0, 0, 28).stroke({ color: 0x1890ff, width: 3 })
    c.addChild(ring)
  }

  const body = new Graphics()
  body.circle(0, 0, 20).fill(STATUS_COLOR[role.status])
  body.circle(0, 0, 20).stroke({ color: 0xffffff, width: 2 })
  c.addChild(body)

  const initial = new Text({
    text: (role.name.trim().charAt(0) || '?').toUpperCase(),
    style: { fill: 0xffffff, fontSize: 18, fontFamily: 'sans-serif', fontWeight: 'bold' },
  })
  initial.anchor.set(0.5)
  c.addChild(initial)

  const nameTag = new Text({
    text: role.name,
    style: { fill: 0xffffff, fontSize: 12, fontFamily: 'sans-serif' },
  })
  nameTag.anchor.set(0.5, 0)
  nameTag.y = 24
  c.addChild(nameTag)

  const bubble = new Container()
  bubble.y = -40
  const bubbleBg = new Graphics()
  bubbleBg
    .roundRect(-32, -13, 64, 22, 6)
    .fill({ color: 0x000000, alpha: 0.75 })
    .stroke({ color: STATUS_COLOR[role.status], width: 1 })
  bubble.addChild(bubbleBg)
  const bubbleTxt = new Text({
    text: STATUS_LABEL[role.status],
    style: { fill: 0xffffff, fontSize: 11, fontFamily: 'sans-serif' },
  })
  bubbleTxt.anchor.set(0.5)
  bubble.addChild(bubbleTxt)
  c.addChild(bubble)

  return c
}

export const RoleWorkCanvas = () => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const roleLayerRef = useRef<Container | null>(null)
  const sceneItemLayerRef = useRef<Container | null>(null)
  const floorTileLayerRef = useRef<Container | null>(null)
  const gridLayerRef = useRef<Container | null>(null)
  const officeSuiteTexRef = useRef<Texture | null>(null)
  const floorTexRef = useRef<Texture | null>(null)

  // 订阅 store
  const roles = useRoleWorkStore((s) => s.roles)
  const selectedRoleId = useRoleWorkStore((s) => s.selectedRoleId)
  const sceneItems = useRoleWorkStore((s) => s.sceneItems)
  const floorTiles = useRoleWorkStore((s) => s.floorTiles)
  const brush = useRoleWorkStore((s) => s.brush)

  /** 同步角色 */
  const syncRoles = useCallback(() => {
    const layer = roleLayerRef.current
    if (!layer) return
    layer.removeChildren()
    const { roles: rs, selectedRoleId: sel } = useRoleWorkStore.getState()
    rs.forEach((role) => {
      const ws = useRoleWorkStore.getState().workstations.find((w) => w.id === role.seatId)
      const x = ws?.x ?? role.x
      const y = ws?.y ?? role.y
      layer.addChild(
        createRoleContainer(role, x, y, role.id === sel, (id, nx, ny) => {
          useRoleWorkStore.getState().setRolePosition(id, nx, ny)
        }),
      )
    })
  }, [])

  /** 同步场景物件 */
  const syncSceneItems = useCallback(() => {
    const layer = sceneItemLayerRef.current
    const tex = officeSuiteTexRef.current
    if (!layer || !tex) return
    layer.removeChildren()
    useRoleWorkStore.getState().sceneItems.forEach((item) => {
      const spriteTex = new Texture({ source: tex.source, frame: toPixiRect(item.rect) })
      const sprite = new Sprite(spriteTex)
      sprite.x = item.x
      sprite.y = item.y
      sprite.scale.set(item.scale)
      sprite.zIndex = item.y
      layer.addChild(sprite)
    })
  }, [])

  /** 同步地板砖 */
  const syncFloorTiles = useCallback(() => {
    const layer = floorTileLayerRef.current
    const tex = floorTexRef.current
    if (!layer || !tex) return
    layer.removeChildren()
    const { floorTiles: tiles, gridSize } = useRoleWorkStore.getState()
    tiles.forEach((tile) => {
      const spriteTex = new Texture({ source: tex.source, frame: toPixiRect(tile.rect) })
      const sprite = new Sprite(spriteTex)
      sprite.x = tile.gridX * gridSize
      sprite.y = tile.gridY * gridSize
      sprite.width = gridSize
      sprite.height = gridSize
      layer.addChild(sprite)
    })
  }, [])

  /** 绘制/更新网格 overlay */
  const syncGrid = useCallback((visible: boolean) => {
    const layer = gridLayerRef.current
    if (!layer) return
    layer.removeChildren()
    if (!visible) return
    const { gridSize } = useRoleWorkStore.getState()
    const g = new Graphics()
    const cols = Math.ceil(SCENE_W / gridSize)
    const rows = Math.ceil(SCENE_H / gridSize)
    for (let i = 0; i <= cols; i++) {
      const x = i * gridSize
      g.moveTo(x, 0).lineTo(x, SCENE_H)
    }
    for (let j = 0; j <= rows; j++) {
      const y = j * gridSize
      g.moveTo(0, y).lineTo(SCENE_W, y)
    }
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.15 })
    layer.addChild(g)
  }, [])

  // 初始化 Pixi（命令式，仅一次）
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const state = { mounted: true }
    const isAlive = () => state.mounted
    const app = new Application()
    const world = new Container()
    world.sortableChildren = true

    const fit = () => {
      const w = app.renderer.width / app.renderer.resolution
      const h = app.renderer.height / app.renderer.resolution
      const scale = Math.min(w / SCENE_W, h / SCENE_H)
      world.scale.set(scale)
      world.x = (w - SCENE_W * scale) / 2
      world.y = (h - SCENE_H * scale) / 2
    }

    void (async () => {
      // 画布初始为空：仅深色背景，不加载 complete_scene
      await app.init({ background: '#0d0d0d', resizeTo: host, antialias: true })
      if (!isAlive()) {
        try {
          app.destroy(true, { children: true })
        } catch {
          /* ignore */
        }
        return
      }
      host.appendChild(app.canvas)
      app.stage.addChild(world)
      app.stage.eventMode = 'static'

      // 地板砖层（最底层）
      const floorTileLayer = new Container()
      world.addChild(floorTileLayer)
      floorTileLayerRef.current = floorTileLayer

      // 加载 floor.png 纹理
      const floorTex = await Assets.load(ASSETS.floor)
      if (!isAlive()) return
      floorTexRef.current = floorTex

      // 网格 overlay 层（地板画笔激活时显示）
      const gridLayer = new Container()
      gridLayer.zIndex = 100
      world.addChild(gridLayer)
      gridLayerRef.current = gridLayer

      // 加载 office_suite 纹理
      const officeTex = await Assets.load(ASSETS.officeSuite)
      if (!isAlive()) return
      officeSuiteTexRef.current = officeTex

      // 场景物件层
      const sceneItemLayer = new Container()
      sceneItemLayer.sortableChildren = true
      world.addChild(sceneItemLayer)
      sceneItemLayerRef.current = sceneItemLayer

      // 角色层
      const roleLayer = new Container()
      roleLayer.sortableChildren = true
      world.addChild(roleLayer)
      roleLayerRef.current = roleLayer

      // 画布点击：放置画笔
      app.stage.hitArea = app.screen
      app.stage.on('pointertap', (e: FederatedPointerEvent) => {
        const b = useRoleWorkStore.getState().brush
        if (!b) return
        const local = world.toLocal(e.global)
        if (b.type === 'floor') {
          // 吸附到网格
          const gs = useRoleWorkStore.getState().gridSize
          const gridX = Math.floor(local.x / gs)
          const gridY = Math.floor(local.y / gs)
          useRoleWorkStore.getState().setFloorTile({ gridX, gridY, rect: b.rect })
        } else if (b.type === 'item') {
          useRoleWorkStore.getState().addSceneItem({
            rect: b.rect,
            x: local.x,
            y: local.y,
            scale: 1,
          })
        } else {
          // 放置角色
          useRoleWorkStore.getState().updateRole(b.roleId, {
            x: local.x,
            y: local.y,
            seatId: null,
          })
          useRoleWorkStore.getState().setBrush(null)
        }
      })

      fit()
      app.renderer.on('resize', fit)

      appRef.current = app

      // 尝试加载已保存的场景
      useRoleWorkStore.getState().loadScene()

      syncFloorTiles()
      syncSceneItems()
      syncRoles()
      syncGrid(useRoleWorkStore.getState().brush?.type === 'floor')
    })()

    return () => {
      state.mounted = false
      roleLayerRef.current = null
      sceneItemLayerRef.current = null
      floorTileLayerRef.current = null
      gridLayerRef.current = null
      officeSuiteTexRef.current = null
      floorTexRef.current = null
      appRef.current = null
      try {
        app.destroy(true, { children: true })
      } catch {
        /* ignore */
      }
    }
  }, [syncRoles, syncSceneItems, syncFloorTiles, syncGrid])

  // store 变化时重同步
  useEffect(() => {
    syncRoles()
  }, [syncRoles, roles, selectedRoleId])

  useEffect(() => {
    syncSceneItems()
  }, [syncSceneItems, sceneItems])

  useEffect(() => {
    syncFloorTiles()
  }, [syncFloorTiles, floorTiles])

  // 地板画笔激活时显示网格
  useEffect(() => {
    syncGrid(brush?.type === 'floor')
  }, [syncGrid, brush])

  // 画笔光标
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.style.cursor = brush ? 'crosshair' : 'default'
  }, [brush])

  return <div ref={hostRef} className={styles.canvasHost} />
}
