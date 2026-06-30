/**
 * 从 BMad _bmad/config.toml 解析出来的角色定义
 */
export interface BmadAgent {
  /** agent key，如 "bmad-agent-analyst" */
  id: string
  /** 所属模块：bmm / bmb / tea */
  module: string
  /** 团队 */
  team: string
  /** 角色名称，如 "Mary" */
  name: string
  /** 角色标题，如 "Business Analyst" */
  title: string
  /** 图标 emoji */
  icon: string
  /** 角色描述 */
  description: string
}
