import { useState } from 'react'
import { Button, Popconfirm, Tooltip } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { useRoleWorkStore } from './store'
import type { Role, RoleStatus } from './store'
import { CreateRoleModal } from './CreateRoleModal'
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
 * 顶部角色栏：横向展示所有角色（蓝色圆点 + 名字），点击进入私聊。
 * 右侧"创建"按钮打开 CreateRoleModal。
 */
export const RoleBar = () => {
  const roles = useRoleWorkStore((s) => s.roles)
  const selectedRoleId = useRoleWorkStore((s) => s.selectedRoleId)
  const selectRole = useRoleWorkStore((s) => s.selectRole)
  const removeRole = useRoleWorkStore((s) => s.removeRole)
  const setChatMode = useRoleWorkStore((s) => s.setChatMode)
  const setActivePrivateRole = useRoleWorkStore((s) => s.setActivePrivateRole)
  const setBrush = useRoleWorkStore((s) => s.setBrush)
  const brush = useRoleWorkStore((s) => s.brush)

  const [createOpen, setCreateOpen] = useState(false)

  const handleRoleClick = (role: Role) => {
    // 点击角色：进入私聊模式，并选中该角色
    setChatMode('private')
    setActivePrivateRole(role.id)
    selectRole(role.id)
    setBrush(null)
  }

  const handlePlaceRole = (role: Role, e: React.MouseEvent) => {
    e.stopPropagation()
    // 切换放置画笔：再次点击同一角色则取消
    if (brush?.type === 'role' && brush.roleId === role.id) {
      setBrush(null)
    } else {
      setBrush({ type: 'role', roleId: role.id })
    }
  }

  return (
    <>
      <div className={styles.roleBar}>
        <div className={styles.roleBarScroll}>
          {roles.length === 0 ? (
            <span className={styles.roleBarEmpty}>暂无角色，点击右侧"创建"添加</span>
          ) : (
            roles.map((role) => {
              const active = role.id === selectedRoleId
              const isPlacing = brush?.type === 'role' && brush.roleId === role.id
              return (
                <div
                  key={role.id}
                  className={`${styles.roleChip} ${active ? styles.roleChipActive : ''} ${isPlacing ? styles.roleChipPlacing : ''}`}
                >
                  <div className={styles.roleChipMain} onClick={() => handleRoleClick(role)}>
                    <span
                      className={styles.roleDot}
                      style={{ background: STATUS_COLOR[role.status] }}
                    />
                    <span className={styles.roleChipName}>{role.name}</span>
                    <span className={styles.roleChipStatus}>{STATUS_LABEL[role.status]}</span>
                  </div>
                  <Tooltip title="放置到画布">
                    <Button
                      type="text"
                      size="small"
                      className={styles.roleChipBtn}
                      onClick={(e) => handlePlaceRole(role, e)}
                    >
                      📍
                    </Button>
                  </Tooltip>
                  <Popconfirm
                    title="删除该角色？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => removeRole(role.id)}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      className={styles.roleChipBtn}
                      icon={<Trash2 size={13} />}
                    />
                  </Popconfirm>
                </div>
              )
            })
          )}
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setCreateOpen(true)}
          className={styles.createBtn}
        >
          创建角色
        </Button>
      </div>
      <CreateRoleModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}
