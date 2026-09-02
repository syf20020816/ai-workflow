---
title: Picop 文档
hero:
  title: Picop 文档
  description: Picop 是一个设计时（Design-time）编排平台，不是最终工作流的运行时, 用于设计和验证工作流的执行流程。
  actions:
    - text: 项目概览
      link: /overview
    - text: 快速入门
      link: /tutorial/quickstart
features:
  - title: 不内置也不配置模型
    description: AI 类节点直接复用用户本机的 Claude Code / Codex / DeepSeek，执行靠本地 Runner，凭据全留用户机器
  - title: 不重复造 Spec 框架
    description: 阶段标记（specStep）由平台负责，specs/ 目录由 openspec / speckit 等专业框架生成
  - title: 编辑器即验证台
    description: 所见即所得，支持单节点调试、PIN 固定、断点续跑
  - title: PIN 机制
    description: 满足迭代调试场景，避免重复消耗 Token
    
---
