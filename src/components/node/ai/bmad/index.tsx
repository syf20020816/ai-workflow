import type { NodeProps } from '@xyflow/react'
import type { NBMadAgent } from '#/types'
import styles from '../../index.module.scss'
import { Typography, Tooltip, Button } from 'antd'
import { Tag } from '#/components/tag'
import { DisconnectOutlined } from '@ant-design/icons'
import { UNode } from '../..'
import { useBmadAgentStore } from '#/store/bmad'

const { Text } = Typography

/**
 * # BMad 角色节点
 * 作为 AgentNode 的子节点存在。
 * 当在 AgentNode 编辑面板中选择 BMad 角色时自动创建或更新。
 * 展示角色名称、描述、图标等 BMad config 中定义的信息。
 *
 * 典型使用场景：
 *   AgentNode（配置模型）→ BMadNode（分析视角）→ AI 输出节点
 *   AgentNode → BMadNode（架构师视角）→ BMadNode（开发者视角）→ AI 输出节点
 */
export const BmadAgentNode = (props: NodeProps<NBMadAgent>) => {
  const agents = useBmadAgentStore((state) => state.agents)
  const agentConfig = agents.find(
    (a) => a.name === props.data.agentId || a.title === props.data.role,
  )

  const hasContent = props.data.role || props.data.roleDescription

  return (
    <UNode node={props}>
      {hasContent && (
        <div className={styles.line}>
          {/* 角色标签 + Agent 名称 */}
          <div
            className={styles.row}
            style={{ justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag color="purple">
                <span style={{ fontSize: 8 }}>{agentConfig?.icon}</span>
                {props.data.role || '未知角色'}
              </Tag>
              {agentConfig?.name && (
                <Tag color="geekblue">
                  {agentConfig.name}
                </Tag>
              )}
            </div>
            {/* 断开 BMad 连接按钮 */}
            <Tooltip title="断开 BMad 角色连接">
              <Button
                type="text"
                size="small"
                danger
                icon={<DisconnectOutlined style={{ fontSize: 10 }} />}
                onClick={(e) => {
                  e.stopPropagation()
                  // 通过 CustomEvent 通知父级断开
                  window.dispatchEvent(
                    new CustomEvent('bmad:disconnect', {
                      detail: { nodeId: props.id },
                    }),
                  )
                }}
                style={{ padding: 0, minWidth: 0, height: 16, width: 16 }}
              />
            </Tooltip>
          </div>

          {/* 角色描述 */}
          {props.data.roleDescription && (
            <div className={styles.row}>
              <Tooltip title={props.data.roleDescription}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 9,
                    lineHeight: 1.3,
                    display: 'block',
                    maxWidth: 200,
                  }}
                >
                  {props.data.roleDescription.length > 48
                    ? props.data.roleDescription.slice(0, 48) + '...'
                    : props.data.roleDescription}
                </Text>
              </Tooltip>
            </div>
          )}

          {/* agent ID 显示 */}
          {/* {props.data.agentId && (
            <div className={styles.row}>
              <Text type="secondary" style={{ fontSize: 9, fontFamily: 'monospace' }}>
                {props.data.agentId}
              </Text>
            </div>
          )} */}
        </div>
      )}
    </UNode>
  )
}
