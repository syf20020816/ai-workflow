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
| **智能体节点** | `agent` | 调用 AI 模型进行分析和生成，接收上游所有输入 + 全链路累积上下文 |
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
- **DAG 执行引擎** — 拓扑排序（Kahn 算法）确定执行顺序，分层并行（`Promise.all`），检测循环依赖
- **Pipeline 数据流** — 上游节点 output 自动传递为下游节点 input
- **上下文累积** — 每个节点执行时 BFS 收集全部上游祖先节点，按节点类型提取"规范摘要"组成 `input.upstreams`，保证线性链路中途不丢数据、无需手动补线
- **按节点类型字段提取** — 累积时只保留关键内容字段（agent→`response`、keywordAgent→`keywords`、knowledgeRetrieval→`retrievalContent` 等），丢弃 model/usage/results 等执行元数据，节省 Token
- **内容块优先级与预算截断** — agent 节点把上游内容按优先级拼入 system prompt，超出上下文预算时保留高优先级块开头而非整块丢弃
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
- **PIN 按钮** — 每个节点执行后点击 📌 保存输出到 `workflows/result/.pin/` 目录，文件名为 `nodeType_nodeId.json`
- **Load 加载** — 编辑面板可选择已保存的 PIN 数据加载到内存，按 nodeId 精确注入，同一类型不同节点互不干扰
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
│   ├── workflow.ts           # DAG 执行引擎（拓扑排序 + 分层并行 + 上下文累积）
│   ├── topological.ts        # 拓扑排序 / 分层 / 祖先链（getAncestorIds / getPredecessors）
│   ├── accumulate.ts         # 上下文累积：按节点类型提取关键字段（Token 优化）
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
- **上游集成**：接收上游 Agent 输出的需求分析（response）作为分析依据，并可从祖先链（upstreams）回溯获取 Lark 模板（templateContent）约束最终输出格式；模板节点不在直接前驱时也能拿到

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

## 处理策略与优化手段

### 上下文累积（引擎级）
- 节点输入 = 直接前驱输出合并 + `upstreams`（全部祖先节点的规范摘要，BFS 从近到远收集）
- 保证线性链路中任意位置都能拿到整条链路的上下文，无需手动补线；链路中间节点不丢上游数据

### 按节点类型的字段提取（Token 优化）
| 节点类型 | 累积字段 | 丢弃字段 |
|---------|---------|---------|
| agent / codeAgent | `response` | model / usage / passThrough |
| keywordAgent | `keywords` | queries / raw |
| knowledgeRetrieval | `retrievalContent` | results 数组 / count / collectionNames |
| userInput | `text` / `prompt` | files / urls |
| larkTemplate | `templateContent` | templateUrl |
| lark / larkWikiTraversal | `result` | action / url / success |
| memory | `content` | — |
| bmadAgent | `instructions` | role / agentId |
| 其他类型 | 内容类字段回退 | 执行元数据 |

### 内容块优先级与预算截断
- agent 节点把上游内容按优先级拼入 system prompt：需求分析(10) → 指令(20) → 关键词(30) → 模板(40) → 其他内容(50) → 知识库检索结果(60)
- 预算 = `min(tokenMax × 1.2, 150K 字符)`；超预算时按优先级保留高价值块的开头（检索结果按相关度排序，开头最相关），而非整块丢弃
- 用户消息兜底 `JSON.stringify` 时排除 `upstreams`，避免与 system prompt 内容块重复打包

### 知识库检索优化
- **结果清洗** — 检索结果只保留 `score` + `content` 两个字段，降低 payload
- **双重去重** — 按 `collectionName:id` 去重 → 内容包含去重（保留较长者），避免语义重复结果灌入上下文
- **Qdrant 写入** — upsert 使用 `wait=true` 同步确认，20 points/批量，失败即时暴露

### 安全与健壮性
- **敏感配置不落盘** — 节点 `modal` 持久化时只保留模型 ID 引用（`{ id, alias }`），API Key / URL / Token 不写入工作流 JSON、版本快照、导出文件；加载时按 ID 从 `model.conf.json` 还原（`src/services/modal.ts`）
- **路径穿越检测** — 文件读写校验 `..` 穿越
- **文档上传限制** — ≤5MB，流式批量处理（8 chunks/embedding batch），避免内存溢出
- **向量维度强校验** — 与 embedding 模型匹配（64-16384），避免 Qdrant 静默丢弃不匹配向量
- **后端路由间直接函数调用** — 避免 HTTP 自调用造成内存泄漏

### PIN 调试机制
- 文件存储 `workflows/result/.pin/nodeType_nodeId.json`；注入按 `nodeId` 精确匹配，同一类型不同节点互不干扰
- 跨工作流可按 `nodeType` 复用最新一份固定输出

---

## 设计哲学

本项目聚焦于 **轻量、本地、可调试** 的工作流编排：

- **不构建通用平台**，只解决"BMad+飞书文档+代码分析"的特定场景
- **编辑器即运行时**，所见即所得，支持单节点调试
- **PIN 机制** 满足迭代调试场景，避免重复消耗 Token
- **文件路由 + API 路由一体化**，前后端同仓库，零部署复杂度
