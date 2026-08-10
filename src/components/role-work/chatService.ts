import { useModelStore } from '#/store/model'
import type { Model } from '#/types/model'
import { useRoleWorkStore } from './store'
import type { Role } from './store'

interface AgentRequestBody {
  model: { url: string; modelName: string; apiKey?: string; token?: { min: number; max: number } }
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  systemPrompt: string
  temperature: number
}

interface AgentResponse {
  status: 'success' | 'error'
  output: { response: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }
  error?: string
}

/** 根据 modelName 查找模型配置 */
function resolveModel(modelName: string): Model | undefined {
  return useModelStore.getState().models.find((m) => m.name === modelName)
}

/** 调用单次 AI 接口 */
async function callAgentApi(role: Role, messages: AgentRequestBody['messages']): Promise<string> {
  const model = resolveModel(role.modelName)
  if (!model) throw new Error(`模型 "${role.modelName}" 未找到，请检查角色配置`)
  if (!model.url) throw new Error(`模型 "${role.modelName}" 缺少 API URL`)

  const body: AgentRequestBody = {
    model: { url: model.url, modelName: model.modelName, apiKey: model.apiKey, token: model.token },
    messages,
    systemPrompt: role.skill || `你是 ${role.name}，一个有帮助的 AI 助手。`,
    temperature: 0.7,
  }

  const res = await fetch('/api/execute/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data: AgentResponse = await res.json()
  if (data.status !== 'success') throw new Error(data.error || 'AI 调用失败')
  return data.output.response
}

/** 收集某个会话的历史消息（按时间顺序） */
function collectHistory(conversationId: string): AgentRequestBody['messages'] {
  return useRoleWorkStore
    .getState()
    .messages.filter((m) => m.conversationId === conversationId && m.status === 'done')
    .map((m) => ({
      role: m.author === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))
}

/**
 * 私聊：向指定角色发送消息并获取回复。
 * 会带上该角色的历史对话上下文。
 */
export async function sendPrivateChat(roleId: string, userText: string): Promise<void> {
  const store = useRoleWorkStore.getState()
  const role = store.roles.find((r) => r.id === roleId)
  if (!role) throw new Error('角色不存在')

  const conversationId = `p:${roleId}`
  store.addMessage({ conversationId, author: 'user', content: userText, status: 'done' })

  const history = collectHistory(conversationId)
  store.setRoleStatus(roleId, 'thinking')

  const pendingId = store.addMessage({
    conversationId,
    author: role.id,
    content: '',
    status: 'pending',
  })

  try {
    const reply = await callAgentApi(role, history)
    useRoleWorkStore.getState().updateMessage(pendingId, {
      content: reply,
      status: 'done',
    })
    useRoleWorkStore.getState().setRoleStatus(roleId, 'success')
  } catch (err) {
    useRoleWorkStore.getState().updateMessage(pendingId, {
      content: `错误：${(err as Error).message}`,
      status: 'error',
    })
    useRoleWorkStore.getState().setRoleStatus(roleId, 'error')
    throw err
  }
}

/**
 * 群聊：向所有角色广播消息，每个角色自主判断是否需要回复。
 * 通过在系统指令中追加"判断提示"，让 AI 决定是否参与。
 */
export async function sendGroupChat(userText: string): Promise<void> {
  const store = useRoleWorkStore.getState()
  const roles = store.roles
  if (roles.length === 0) throw new Error('暂无角色，请先创建')

  const conversationId = 'group'
  store.addMessage({ conversationId, author: 'user', content: userText, status: 'done' })

  // 并发调用所有角色；每个角色独立判断是否回复
  await Promise.all(
    roles.map(async (role) => {
      store.setRoleStatus(role.id, 'thinking')
      const pendingId = store.addMessage({
        conversationId,
        author: role.id,
        content: '',
        status: 'pending',
      })

      // 群聊判断指令：要求 AI 先判断是否需要自己回复
      const judgeInstruction = [
        `你正在一个群聊中，群里有以下角色：${roles.map((r) => r.name).join('、')}。`,
        `用户发出了以下指令：「${userText}」`,
        `请根据你的角色定位判断：这条指令是否需要你来处理或回复？`,
        `如果不需要你参与，请只回复 "SKIP"（不含其它内容）。`,
        `如果需要你参与，请给出你的专业回复。`,
      ].join('\n')

      try {
        const history = collectHistory(conversationId)
        const reply = await callAgentApi(role, [
          ...history,
          { role: 'user', content: judgeInstruction },
        ])

        if (reply.trim().toUpperCase() === 'SKIP' || reply.trim() === '') {
          // 角色选择跳过：移除 pending 占位消息
          useRoleWorkStore.getState().updateMessage(pendingId, {
            content: '（未参与）',
            status: 'done',
          })
        } else {
          useRoleWorkStore.getState().updateMessage(pendingId, {
            content: reply,
            status: 'done',
          })
        }
        useRoleWorkStore.getState().setRoleStatus(role.id, 'success')
      } catch (err) {
        useRoleWorkStore.getState().updateMessage(pendingId, {
          content: `错误：${(err as Error).message}`,
          status: 'error',
        })
        useRoleWorkStore.getState().setRoleStatus(role.id, 'error')
      }
    }),
  )
}
