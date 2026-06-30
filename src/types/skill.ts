/**
 * BMad 角色/技能定义
 * 每个角色包含名称、描述、关联技能和默认配置
 */
export interface Skill {
  id: string
  /** 角色名称，如 "需求分析师"、"架构师" */
  name: string
  /** 角色描述 */
  description?: string
  /** 关联的技能列表 */
  skills?: string[]
  /** 默认系统提示词 */
  systemPrompt?: string
  /** 默认温度参数 */
  temperature?: number
}
