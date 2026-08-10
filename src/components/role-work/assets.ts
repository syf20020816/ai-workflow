// 素材位于项目根 assets/ 目录（#/* 别名仅覆盖 src/，故用相对路径）。
// Vite 处理 png import 返回带 hash 的 URL，供 Pixi Assets.load 使用。
import completeScene from '../../../assets/complete_scene.png'
import completeSceneNoFloor from '../../../assets/complete_scene_no_floor.png'
import officeSuite from '../../../assets/office_suite.png'
import floor from '../../../assets/floor.png'
import roleStand from '../../../assets/role_stand.png'
import roleWalk from '../../../assets/role_walk.png'
import roleWork from '../../../assets/role_work.png'

export const ASSETS = {
  /** MVP 整张铺底场景（地板+家具合成） */
  completeScene,
  /** 同布局但地板透明，Phase 2 分层合成用 */
  completeSceneNoFloor,
  /** 透明背景独立物件集合，Phase 2 精灵切片源 */
  officeSuite,
  /** 低多边形地形模块 */
  floor,
  /** 角色站立精灵图 */
  roleStand,
  /** 角色行走精灵图 */
  roleWalk,
  /** 角色工作精灵图 */
  roleWork,
} as const
