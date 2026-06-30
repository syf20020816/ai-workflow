/**
 * 解析 BMad config.toml 中的 agents 段
 * config.toml 格式：
 *   [agents.bmad-agent-analyst]
 *   module = "bmm"
 *   team = "software-development"
 *   name = "Mary"
 *   title = "Business Analyst"
 *   icon = "📊"
 *   description = "..."
 */
export function parseBmadAgents(tomlContent: string) {
  const agents: Array<Record<string, string>> = []

  // 匹配 [agents.xxx] 段，惰性匹配到下一个 [ 或末尾
  const sectionRegex = /\[agents\.([^\]]+)\]\s*\n([\s\S]*?)(?=\n\[|\s*$)/g
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(tomlContent)) !== null) {
    const id = match[1]
    const body = match[2]

    const props: Record<string, string> = {}
    // 匹配 key = "value"（处理转义引号）
    const propRegex = /(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/g
    let propMatch: RegExpExecArray | null
    while ((propMatch = propRegex.exec(body)) !== null) {
      props[propMatch[1]] = propMatch[2]
    }

    if (Object.keys(props).length > 0) {
      props.id = id
      agents.push(props)
    }
  }

  return agents
}
