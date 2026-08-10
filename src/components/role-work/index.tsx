import { ChatPanel } from './ChatPanel'
import { RoleBar } from './RoleBar'
import { RoleWorkCanvas } from './RoleWorkCanvas'
import { SceneBuilder } from './SceneBuilder'
import styles from './index.module.scss'

/**
 * 多角色工作页：
 * - 顶部 RoleBar：横向角色列表 + 创建入口
 * - 中部：左侧 PixiJS 场景画布 + 右侧 ChatPanel（私聊/群聊）
 * - 底部 SceneBuilder：从 office_suite.png 框选素材搭建场景
 */
export const RoleWork = () => {
  return (
    <div className={styles.roleWork}>
      <RoleBar />
      <div className={styles.middleRow}>
        <div className={styles.canvasArea}>
          <RoleWorkCanvas />
        </div>
        <aside className={styles.chatSide}>
          <ChatPanel />
        </aside>
      </div>
      <SceneBuilder />
    </div>
  )
}
