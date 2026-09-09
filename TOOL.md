# 工具推荐

- Repomix — 整仓打包成单个 AI 友好文件（XML/MD），带 token 计数、敏感信息检测、MCP server 模式。可接进 Runner：codeAgent/selfCheck 前先用 repomix 生成仓库快照注入 prompt，替代/补充现有 gitDiff 方案
- Context7 — 9000+ 库的实时文档 MCP，按版本注入最新 API 文档，减少幻觉（已验证 41 万+安装）
- codebase-memory-mcp — C 实现的代码知识图谱 MCP（3.1 万星）：AST 调用链、跨文件依赖、3D 可视化，比逐文件检索强
- DeepWiki / OpenDeepWiki — 仓库自动理解/文档生成