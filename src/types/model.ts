export const ModalKinds = {
  /** 本地模型，例如使用Ollama */
  Local: 'local',
  /** 云模型，例如使用OpenAI */
  Cloud: 'cloud',
}

export type ModalKind = (typeof ModalKinds)[keyof typeof ModalKinds]

/**
 * 模型定义
 */
export interface Model {
  id: string
  kind: ModalKind
  /** 自定义模型名称，用于在工作流中引用 */
  name: string
  description?: string
  /** 云模型的API URL */
  url?: string
  /** 云模型的API密钥 */
  apiKey?: string
  /** 模型名称 */
  modelName: string
  token?: {
    min: number
    max: number
  }
}
