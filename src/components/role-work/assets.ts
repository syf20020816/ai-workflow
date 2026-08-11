import role1 from '../../../assets/role/role1.png'
import role2 from '../../../assets/role/role2.png'
import role3 from '../../../assets/role/role3.png'
import role4 from '../../../assets/role/role4.png'
import role5 from '../../../assets/role/role5.png'
import role6 from '../../../assets/role/role6.png'

/** 6 个角色头像（从 role 精灵图切分而来） */
export const ROLE_AVATARS: string[] = [role1, role2, role3, role4, role5, role6]

export const ASSETS = {
  /** 6 个角色头像图片 */
  roleAvatars: ROLE_AVATARS,
} as const
