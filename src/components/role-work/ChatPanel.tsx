import { useEffect, useRef, useState } from 'react'
import { Button, Input, Segmented, Tooltip } from 'antd'
import { Send } from 'lucide-react'
import { useRoleWorkStore } from './store'
import type { ChatMode } from './store'
import { sendGroupChat, sendPrivateChat } from './chatService'
import styles from './index.module.scss'

/**
 * 聊天面板：支持私聊与群聊两种模式。
 * - 私聊：仅与当前选中角色对话（点击 RoleBar 角色进入）。
 * - 群聊：向所有角色广播，AI 自主判断是否回复。
 */
export const ChatPanel = () => {
  const chatMode = useRoleWorkStore((s) => s.chatMode)
  const setChatMode = useRoleWorkStore((s) => s.setChatMode)
  const activePrivateRoleId = useRoleWorkStore((s) => s.activePrivateRoleId)
  const messages = useRoleWorkStore((s) => s.messages)
  const roles = useRoleWorkStore((s) => s.roles)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  const activeRole = roles.find((r) => r.id === activePrivateRoleId)
  const conversationId = chatMode === 'private' && activePrivateRoleId ? `p:${activePrivateRoleId}` : 'group'
  const visibleMessages = messages.filter((m) => m.conversationId === conversationId)

  // 新消息时自动滚动到底部
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visibleMessages.length])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    if (chatMode === 'private') {
      if (!activePrivateRoleId) return
      setInput('')
      setSending(true)
      try {
        await sendPrivateChat(activePrivateRoleId, text)
      } catch {
        /* 错误已写入消息 */
      } finally {
        setSending(false)
      }
    } else {
      if (roles.length === 0) return
      setInput('')
      setSending(true)
      try {
        await sendGroupChat(text)
      } catch {
        /* 错误已写入消息 */
      } finally {
        setSending(false)
      }
    }
  }

  const handleModeChange = (val: ChatMode) => {
    setChatMode(val)
  }

  const roleName = (authorId: string) => {
    if (authorId === 'user') return '我'
    return roles.find((r) => r.id === authorId)?.name ?? 'AI'
  }

  const headerTitle =
    chatMode === 'private'
      ? activeRole
        ? `私聊：${activeRole.name}`
        : '私聊（未选择角色）'
      : `群聊（${roles.length} 个角色）`

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <span className={styles.chatTitle}>{headerTitle}</span>
        <Segmented
          size="small"
          value={chatMode}
          onChange={(v) => handleModeChange(v as ChatMode)}
          options={[
            { label: '私聊', value: 'private' },
            { label: '群聊', value: 'group' },
          ]}
        />
      </div>

      <div className={styles.chatLog} ref={logRef}>
        {visibleMessages.length === 0 ? (
          <div className={styles.chatEmpty}>
            {chatMode === 'private'
              ? activeRole
                ? `与 ${activeRole.name} 开始对话…`
                : '点击顶部角色开始私聊'
              : '在群聊中向所有角色广播指令，AI 会自主判断是否回复'}
          </div>
        ) : (
          visibleMessages.map((m) => {
            const isUser = m.author === 'user'
            return (
              <div
                key={m.id}
                className={`${styles.msgRow} ${isUser ? styles.msgUser : styles.msgBot}`}
              >
                <span className={styles.msgAuthor}>{roleName(m.author)}</span>
                <div className={`${styles.msgBubble} ${isUser ? styles.msgBubbleUser : ''}`}>
                  {m.status === 'pending' ? (
                    <span className={styles.msgPending}>思考中…</span>
                  ) : (
                    <span className={styles.msgContent}>{m.content}</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className={styles.chatInput}>
        <Input.TextArea
          placeholder={
            chatMode === 'private'
              ? activeRole
                ? `向 ${activeRole.name} 发送消息…`
                : '请先选择角色'
              : '向所有角色广播指令…'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          disabled={chatMode === 'private' && !activeRole}
        />
        <Tooltip title="Enter 发送，Shift+Enter 换行">
          <Button
            type="primary"
            icon={<Send size={15} />}
            loading={sending}
            onClick={handleSend}
            disabled={chatMode === 'private' && !activeRole}
          />
        </Tooltip>
      </div>
    </div>
  )
}
