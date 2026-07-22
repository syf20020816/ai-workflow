/**
 * 角色/技能定义
 * 每个角色包含名称、描述、关联技能和默认配置
 */
export interface Skill {
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description?: string
  /** 关联的技能列表 */
  skills?: string[]
  /** 系统提示词/指令内容 */
  systemPrompt?: string
  /** 默认温度参数 */
  temperature?: number
  /** 来源：bmad | custom | markdown */
  source?: 'bmad' | 'custom' | 'markdown'
  /** 如果是 markdown 文件导入，记录文件路径 */
  filePath?: string
}
