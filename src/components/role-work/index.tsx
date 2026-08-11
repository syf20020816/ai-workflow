import { ChatPanel } from './ChatPanel'
import { RoleBar } from './RoleBar'
import styles from './index.module.scss'

/**
 * 多角色工作页：
 * - 左侧（300px）RoleBar：纵向角色卡片列表 + 创建入口
 * - 右侧 ChatPanel：私聊 / 群聊，全宽展示
 */
export const RoleWork = () => {
  return (
    <div className={styles.roleWork}>
      <aside className={styles.sideBar}>
        <RoleBar />
      </aside>
      <div className={styles.chatArea}>
        <ChatPanel />
      </div>
    </div>
  )
}
