# 项目概览（Overview）

## 这是什么

AI Workflow 是一个基于 **BMad Method** + **Lark CLI** 构建的轻量化 **AI 工作流可视化编排工具**。它用可视化 DAG 画布组合多种节点（需求分析 / 概设 / 任务拆解 / 编码 / 自检 / 知识库 / Lark 文档…），适合需要快速搭建 AI Agent 工作流的场景，避免了 Dify 等重型平台的复杂性。

## 平台定位：编排 → 验证 → 导出

本项目是一个**设计时（Design-time）编排平台**，不是最终工作流的运行时：

1. **编排** — 用可视化 DAG 画布组合 21 种节点，并在 Spec 模式下用脚印按钮标记每个节点的输出属于哪个工作流阶段（功能规格 / 技术方案 / 任务清单 / 自检报告…）。
2. **验证** — 平台内置的轻量 Agent 仅用于验证编排是否正确（单节点调试 / PIN 固定 / 断点续跑 / 输出检查）。复杂 Agent 交给专业的 Codex / Claude Code 等工具。
3. **导出** — 编排与验证通过后，把工作流导出为 `workflow.yml`（类 speckit 格式），放入自己的 **Codex / Trae / Claude Code** 中执行。

> **Spec 分工（边界清晰）**：平台**不生产 `specs/` 目录**——那是 openspec / speckit 等专业 spec 框架的职责。平台只做**阶段标记**（`specStep`），导出后的 `workflow.yml` 携带标记，spec 框架据此自动生成 `specs/` 目录。

## 设计哲学

| 原则 | 说明 |
|------|------|
| 不自建复杂 Agent 运行时 | 内置简单 Agent 只用于编排验证；最终执行交给用户自己的 Codex / Trae / Claude Code |
| 不重复造 Spec 框架 | 阶段标记（specStep）由平台负责，specs/ 目录由 openspec / speckit 等专业框架生成 |
| 编辑器即验证台 | 所见即所得，支持单节点调试、PIN 固定、断点续跑 |
| PIN 机制 | 满足迭代调试场景，避免重复消耗 Token |
| 前后端同仓库 | 文件路由 + API 路由一体化，零部署复杂度 |

## 技术栈

- **框架**: React 19 + TypeScript 6 + Vite 8
- **路由**: TanStack Router（文件路由 + API 路由）
- **UI**: Ant Design 6 + Radix UI Icons + Lucide Icons
- **画布**: React Flow 12 (`@xyflow/react`)
- **状态**: Zustand 5 + Immer 11
- **样式**: Sass (SCSS Modules)
- **服务端**: Node.js + TanStack Router Server Functions
- **AI SDK**: Vercel AI SDK（`ai` + `@ai-sdk/openai`）

## 项目结构

```
src/
├── engine/
│   ├── workflow.ts           # DAG 执行引擎（拓扑排序 + 分层并行 + 上下文累积）
│   ├── topological.ts        # 拓扑排序 / 分层 / 祖先链
│   ├── accumulate.ts         # 上下文累积：按节点类型提取关键字段（Token 优化）
│   └── executors/            # 21 种节点执行器
├── components/
│   ├── flow.tsx              # React Flow 画布
│   ├── node/                 # 节点渲染组件
│   ├── panel/                # 编辑面板（编辑/执行/输出/结果）
│   ├── execution/            # 执行面板
│   ├── wiki/                 # 文档阅读（Docs）
│   ├── file-editor/          # 文件编辑器（含 CodeEditor / MdPreview）
│   └── ...
├── services/                # 共享服务（前后端共用）
│   ├── ai.ts                # AI 调用封装（callAI）
│   ├── upstreamContext.ts   # 上游累积上下文构建
│   └── ...
├── store/                   # Zustand 全局状态
├── types/                   # 类型定义 & NodeBuilder 工厂
└── routes/
    ├── index.tsx             # 首页（画布+编辑+执行面板）
    └── api/                  # 后端 API 路由
docs/                        # 平台使用与学习文档（本目录）
workflows/                   # 保存的工作流模板 / PIN 结果 / 技能
prompts/                     # 提示词模板
memory/                      # 记忆文件
```

## 核心概念速览

| 概念 | 说明 |
|------|------|
| 节点（Node） | 工作流的最小单元，共 21 种类型（输入 / 智能体 / 角色 / 编码 / 拆解 / 自检 / 知识库 / Lark / 条件 / 循环 / 重试…） |
| 连线（Edge） | 节点间的数据流，上游 output 自动传递为下游 input |
| 上下文累积 | 每个节点执行时 BFS 收集全部上游祖先节点，按类型提取"规范摘要"，保证线性链路不丢数据 |
| PIN | 节点输出固定：保存执行结果到文件，支持从中间节点断点续跑 |
| specStep | 阶段标记：标记节点输出属于工作流的哪个阶段（spec/plan/tasks/report…） |
| BMad 角色 | 从 `.bmad/` 提取的多角色 persona 指令，注入智能体作为 system prompt |

## 下一步

- [快速上手](quickstart.md) — 5 分钟跑通第一个工作流
- [深入指南](detail.md) — 节点、引擎、PIN、BMad 等原理详解
