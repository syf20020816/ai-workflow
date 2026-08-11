import { useState } from 'react'
import { Button, Popconfirm, Tooltip } from 'antd'
import { Plus, Trash2, UsersRound } from 'lucide-react'
import { useRoleWorkStore } from './store'
import type { Role, RoleStatus } from './store'
import { CreateRoleModal } from './CreateRoleModal'
import { ASSETS } from './assets'
import styles from './index.module.scss'

const STATUS_COLOR: Record<RoleStatus, string> = {
  idle: '#8c8c8c',
  working: '#1890ff',
  thinking: '#722ed1',
  success: '#52c41a',
  error: '#ff4d4f',
}

const STATUS_LABEL: Record<RoleStatus, string> = {
  idle: '空闲',
  working: '工作中',
  thinking: '思考中',
  success: '完成',
  error: '错误',
}

/**
 * 角色卡片：使用独立头像图片（基于 spriteIndex 选择）。
 */
const RoleCard = ({
  role,
  active,
  onClick,
  onRemove,
}: {
  role: Role
  active: boolean
  onClick: () => void
  onRemove: () => void
}) => {
  const avatarUrl =
    ASSETS.roleAvatars[role.spriteIndex] ?? ASSETS.roleAvatars[0]

  return (
    <div
      className={`${styles.roleCard} ${active ? styles.roleCardActive : ''}`}
      onClick={onClick}
    >
      <div className={styles.roleAvatar}>
        <img className={styles.roleAvatarImg} src={avatarUrl} alt={role.name} />
        <span
          className={styles.roleStatusDot}
          style={{ background: STATUS_COLOR[role.status] }}
        />
      </div>
      <div className={styles.roleCardInfo}>
        <span className={styles.roleCardName}>{role.name}</span>
        <span className={styles.roleCardStatus}>
          {STATUS_LABEL[role.status]}
        </span>
        {role.modelName && (
          <span className={styles.roleCardModel}>{role.modelName}</span>
        )}
      </div>
      <Popconfirm
        title="删除该角色？"
        okText="删除"
        cancelText="取消"
        onConfirm={(e) => {
          e?.stopPropagation()
          onRemove()
        }}
      >
        <Tooltip title="删除">
          <Button
            type="text"
            size="small"
            danger
            className={styles.roleCardBtn}
            onClick={(e) => e.stopPropagation()}
            icon={<Trash2 size={13} />}
          />
        </Tooltip>
      </Popconfirm>
    </div>
  )
}

/**
 * 左侧角色栏：纵向展示所有角色卡片（精灵图头像 + 名字 + 状态），点击进入私聊。
 * 底部"创建"按钮打开 CreateRoleModal。
 */
export const RoleBar = () => {
  const roles = useRoleWorkStore((s) => s.roles)
  const selectedRoleId = useRoleWorkStore((s) => s.selectedRoleId)
  const selectRole = useRoleWorkStore((s) => s.selectRole)
  const removeRole = useRoleWorkStore((s) => s.removeRole)
  const setChatMode = useRoleWorkStore((s) => s.setChatMode)
  const setActivePrivateRole = useRoleWorkStore((s) => s.setActivePrivateRole)

  const [createOpen, setCreateOpen] = useState(false)

  const handleRoleClick = (role: Role) => {
    setChatMode('private')
    setActivePrivateRole(role.id)
    selectRole(role.id)
  }

  return (
    <>
      <div className={styles.roleBarHeader}>
        <span className={styles.roleBarTitle}>团队成员</span>
        <Button
          type="primary"
          size="small"
          icon={<Plus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          创建
        </Button>
      </div>
      <div className={styles.roleBarList}>
        {roles.length === 0 ? (
          <div className={styles.roleBarEmpty}>
            <div className={styles.roleBarEmptyIcon}>
              <UsersRound />
            </div>
            <div>暂无角色</div>
            <div className={styles.roleBarEmptyHint}>
              点击上方"创建"添加团队成员
            </div>
          </div>
        ) : (
          roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              active={role.id === selectedRoleId}
              onClick={() => handleRoleClick(role)}
              onRemove={() => removeRole(role.id)}
            />
          ))
        )}
      </div>
      <CreateRoleModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}
