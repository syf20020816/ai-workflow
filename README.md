# AI Workflow — 轻量级 AI 工作流可视化编排工具

基于 [BMad Method](https://bmadcodes.com/) + Lark CLI 构建的轻量化 AI 工作流引擎，提供可视化节点编排能力，适合需要快速搭建 AI Agent 工作流的场景，避免 Dify 等重型平台的复杂性。

---

## 已实现功能

### 1. 可视化工作流编辑器
- **[React Flow](https://reactflow.dev/) 画布** — 节点拖拽、连线、缩放、平移，基于 `@xyflow/react` v12
- **MiniMap** + **Controls** — 小地图导航和画布控制
- **暗色主题** — Ant Design darkAlgorithm + React Flow 暗色适配
- **节点选中高亮** — 选中节点蓝色边框

### 2. 15+ 种工作流节点

| 节点类型 | 标识 | 用途 |
|---------|------|------|
| **用户输入节点** | `userInput` | 接受用户输入的文本、提示词、文件/URL 路径 |
| **智能体节点** | `agent` | 调用 AI 模型进行分析和生成，接收上游所有输入 |
| **BMad 角色节点** | `bmadAgent` | 赋予智能体特定角色指令（分析师/架构师/SM 等），内容同步到智能体 |
| **Lark 文档节点** | `lark` | 读取/写入/创建飞书文档，通过 lark-cli 操作 |
| **Lark 模板节点** | `larkTemplate` | 读取飞书文档作为内容模板，传递给下游 |
| **代码分析节点** | `codeAgent` | AI 自主探索本地代码仓库（工具调用循环），支持指定 Git 分支和行范围 |
| **代码节点** | `code` | 读取本地代码文件内容，支持行范围截取 |
| **记忆节点** | `memory` | 读写持久化记忆文件（markdown 格式），跨工作流传递上下文 |
| **Skill 节点** | `skill` | 执行 BMad Skill（分析师/开发者等角色技能） |
| **回答节点** | `answer` | 工作流暂停，等待用户输入后继续 |
| **AI 输出节点** | `aiOutput` | 展示最终输出结果 |
| **判断节点** | `if` / `ifCondition` | 条件分支，根据上游输出匹配关键词或 AI 判断选择路径 |
| **循环节点** | `loop` / `loopCondition` | 循环迭代，支持计数器模式和上游数据驱动模式 |
| **重试节点** | `retry` | 捕获上游错误，支持关键词匹配和 AI 判断两种重试条件 |

### 3. 节点操作
- **添加节点** — 每个节点右侧的 `+` 按钮，下拉选择节点类型，自动生成连线到新节点
- **删除节点** — 编辑面板底部「删除」按钮，同时清理关联连线
- **节点属性编辑** — 右侧编辑面板，点击节点即切换
- **节点标题/描述编辑** — 编辑面板头部可编辑
- **节点拖拽** — 自由拖拽调整布局

### 4. 执行引擎
- **DAG 执行引擎** — 拓扑排序（Kahn 算法）确定执行顺序，检测循环依赖
- **Pipeline 数据流** — 上游节点 output 自动传递为下游节点 input
- **15+ 节点执行器** — 每种节点类型均有独立执行逻辑
- **智能体节点真实 AI API 调用** — 兼容 OpenAI/Anthropic/Ollama 格式（含火山方舟）
- **CodeAgent 工具调用循环** — SDK 管理的 Tool Calling（文件读取、目录遍历、Git 日志），自动循环直到任务完成
- **Lark 节点 CLI 调用** — 通过 `lark-cli` 子进程执行读/写/创建操作
- **Answer 节点暂停/恢复** — 等待用户输入后继续执行
- **孤立节点过滤** — 无连线参与的节点不执行
- **执行控制** — 运行全部/重置/单节点执行，实时状态标签
- **执行日志** — 按节点展示 info/warn/error 日志
- **输出面板** — 独立 Tab 展示各节点输出结果
- **节点输出固定（PIN）** — 保存节点执行结果到文件，支持从 PIN 节点开始执行，避免重复运行上游节点

### 5. 模型管理
- **模型 CRUD** — Table 展示 + Modal 创建/编辑，数据持久化到 `model.conf.json`
- **模型字段** — 名称/描述/模型名/API URL/API Key/Token 范围
- **工作流集成** — 智能体/代码分析节点编辑面板可选择模型

### 6. 提示词管理
- **提示词编辑** — 独立 Tab 页面，支持修改 CodeAgent 系统提示词等模板
- **持久化** — 保存到 `prompts/` 目录

### 7. 工作流导入/导出/模板
- **导入** — 弹窗支持粘贴 JSON 或拖拽上传 JSON 文件
- **导出** — 弹窗展示 JSON（可复制）或下载为 `.json` 文件
- **保存模板** — 保存到 `workflows/` 目录，持久化存储
- **工作流管理** — 独立 Tab 页面，列表展示所有已保存模板，支持加载/删除

### 8. 节点输出固定（PIN）
- **PIN 按钮** — 每个节点执行后点击 📌 保存输出到 `workflows/result/` 目录
- **Load 加载** — 编辑面板可选择已保存的 PIN 数据加载到内存
- **从 PIN 执行** — 执行面板 Select 选择 PIN 节点后运行，跳过上流节点，从该节点下游开始

### 9. 状态管理
- **Zustand** 全局状态管理
- **Immer** 不可变数据更新（`patchCurrentNode`），避免深层 spread
- **NodeBuilder** 工厂模式构建节点，自动生成 UUID 和位置偏移
- **路由树自动生成** — TanStack Router 文件路由，`tsr generate` 自动更新

---

## 技术栈
- **框架**: React 19 + TypeScript 6 + Vite 8
- **路由**: TanStack Router（文件路由 + API 路由）
- **UI**: Ant Design 6 + Radix UI Icons + Lucide Icons
- **画布**: React Flow 12 (`@xyflow/react`)
- **状态**: Zustand 5 + Immer 11
- **样式**: Sass (SCSS Modules)
- **服务端**: Node.js + TanStack Router Server Functions
- **AI SDK**: Vercel AI SDK（`ai` + `@ai-sdk/openai`）

---

## 项目结构

```
src/
├── engine/
│   ├── workflow.ts           # DAG 执行引擎（拓扑排序 + Pipeline 数据流）
│   └── executors/            # 15+ 节点执行器
│       ├── index.ts          # 执行器注册表
│       ├── userInput.ts
│       ├── agent.ts          # AI 智能体调用
│       ├── bmad.ts           # BMad CLI
│       ├── lark.ts           # Lark 文档
│       ├── larkTemplate.ts   # Lark 模板
│       ├── answer.ts         # 回答/暂停
│       ├── aiOutput.ts
│       ├── if.ts             # 条件分支
│       ├── loop.ts           # 循环
│       ├── retry.ts          # 重试
│       ├── code.ts           # 代码读取
│       ├── codeAgent.ts      # CodeAgent
│       ├── memory.ts         # 记忆
│       └── skill.ts          # Skill
├── components/
│   ├── flow.tsx              # React Flow 画布
│   ├── node/                 # 节点渲染组件
│   │   ├── index.tsx         # UNode 通用容器
│   │   ├── header/           # 节点标题/图标
│   │   ├── edge/             # 工具栏按钮
│   │   │   ├── add.tsx       # 「+」添加节点
│   │   │   ├── run.tsx       # 运行节点
│   │   │   └── pin-node.tsx  # PIN 固定按钮
│   │   └── ...               # 各类型节点 UI
│   ├── panel/
│   │   ├── edit.tsx          # 编辑面板（Tabs: 编辑/执行/输出/结果）
│   │   └── edit/             # 各节点编辑组件
│   ├── execution/
│   │   ├── panel.tsx         # 执行面板（运行/PIN选择/状态/日志）
│   │   ├── output.tsx        # 输出面板
│   │   ├── result.tsx        # 执行结果
│   │   └── importExport.tsx  # 导入/导出/保存
│   ├── workflow-manager/     # 工作流管理 Tab
│   ├── prompt-manager/       # 提示词管理 Tab
│   └── model/                # 模型管理 Tab
├── store/
│   └── node.ts               # Zustand 全局状态
├── types/
│   ├── index.ts              # 类型定义 & NodeTypes 常量
│   └── builder.ts            # NodeBuilder 工厂
├── routes/
│   ├── __root.tsx
│   ├── index.tsx             # 首页（画布+编辑+执行面板）
│   └── api/
│       ├── workflows.ts      # 工作流 CRUD
│       ├── model.ts          # 模型管理
│       ├── prompts.ts        # 提示词管理
│       ├── memory.ts         # 记忆管理
│       ├── skill.ts          # Skill 管理
│       ├── editor/           # 文件编辑器
│       ├── execute/          # 执行 API
│       │   ├── agent.ts      # AI 调用
│       │   ├── code.ts       # 代码读取
│       │   ├── codeAgent.ts  # CodeAgent
│       │   ├── lark.ts       # Lark CLI
│       │   └── bmad.ts       # BMad CLI
│       └── workflow/
│           └── pin.ts        # PIN 固定 (GET/POST/DELETE)
├── router.tsx
├── routeTree.gen.ts
└── styles.css
```

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（端口 3030）
npm run dev

# 生成路由（新增 API/页面路由后需要）
npm run generate-routes

# 构建
npm run build
```

### 依赖服务

```bash
# Lark CLI 需在宿主机独立运行（lark-cli auth login）
# BMad 需在宿主机独立运行（npx bmad-method install 后可用）
```

---

## 核心节点详解

### CodeAgent 节点
AI 自主探索本地代码仓库的节点，使用 Vercel AI SDK 的 `generateText` + Tool Calling：
- **工具列表**：`readFile`（读取文件）、`listDirectory`（列出目录）、`runGitLog`（Git 日志）
- **配置**：项目路径、Git 分支、分析指令、最大迭代次数、模型选择
- **上游集成**：可接收上游 Agent 输出的需求分析，带着需求去分析代码

### 条件分支（if）
支持两种判断模式：
- **关键词匹配** — 定义多个关键词，上游输出中包含任一关键词则命中
- **AI 判断** — 让 AI 模型判断上游内容是否需要进入改分支

### 循环（loop）
两种循环模式：
- **固定次数** — 指定迭代次数
- **上游数据驱动** — 根据上游节点输出的数据数组长度决定循环次数

### PIN 功能
用于调试场景，避免重复执行上游节点：
1. 执行节点后点击 📌 保存结果
2. 执行面板 Select 选择已固定的 PIN 节点
3. 点击「运行」→ 引擎注入 PIN 输出，从下游节点继续执行

---

## 设计哲学

本项目聚焦于 **轻量、本地、可调试** 的工作流编排：

- **不构建通用平台**，只解决"BMad+飞书文档+代码分析"的特定场景
- **编辑器即运行时**，所见即所得，支持单节点调试
- **PIN 机制** 满足迭代调试场景，避免重复消耗 Token
- **文件路由 + API 路由一体化**，前后端同仓库，零部署复杂度
