# AI Workflow — 轻量级 AI 工作流可视化编排工具

基于 [BMad Method](https://bmadcodes.com/) + Lark CLI 构建的轻量化 AI 工作流引擎，提供可视化节点编排能力，适合需要快速搭建 AI Agent 工作流的场景，避免 Dify 等重型平台的复杂性。

---

## 已实现功能

### 1. 可视化工作流编辑器
- **[React Flow](https://reactflow.dev/) 画布** — 节点拖拽、连线、缩放、平移，基于 `@xyflow/react` v12
- **MiniMap** + **Controls** — 小地图导航和画布控制
- **暗色主题** — Ant Design darkAlgorithm + React Flow 暗色适配
- **节点选中高亮** — 选中节点蓝色边框

### 2. 21 种工作流节点

| 节点类型 | 标识 | 用途 |
|---------|------|------|
| **用户输入节点** | `userInput` | 接受用户输入的文本、提示词、文件/URL 路径 |
| **智能体节点** | `agent` | 调用 AI 模型进行分析和生成，接收上游所有输入 + 全链路累积上下文 |
| **BMad 角色节点** | `bmadAgent` | 赋予智能体特定角色指令（分析师/架构师/SM 等），内容同步到智能体（BMad 在上游、Agent 在下游，方向已修正） |
| **代码处理节点** | `codeAgent` | AI 自主探索/修改本地代码仓库（工具调用循环），支持 `analyze`（只读分析）/ `batch`（按 tasks.md 分批写代码）双模式 |
| **任务拆解节点** | `taskPlanner` | 把 plan/spec 拆解为可独立执行的 batch 任务清单（「文件/前置/验收」三要素结构化校验），产出 tasks.md |
| **自检 Agent 节点** | `selfCheck` | 独立会话评审：配置 BMad 角色注入评审身份，材料按 Spec 产物 / git diff / 上游累积产物自动降级，输出 PASS / CONDITIONAL_PASS / FAIL |
| **关键词智能体节点** | `keywordAgent` | 从输入中提取关键词列表，供下游使用 |
| **知识库检索节点** | `knowledgeRetrieval` | 基于 embedding 从 Qdrant 向量库检索相关内容 |
| **知识库存储节点** | `knowledgeStore` | 文档入库：embedding 分块写入 Qdrant 向量库 |
| **Lark 文档节点** | `lark` | 读取/写入/创建飞书文档，通过 lark-cli 操作 |
| **Lark 模板节点** | `larkTemplate` | 读取飞书文档作为内容模板，传递给下游 |
| **Lark Wiki 遍历节点** | `larkWikiTraversal` | 遍历飞书知识库节点层级并读取文档内容 |
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
- **内容块优先级与预算截断** — agent 节点把上游内容按优先级拼入 system prompt，超出上下文预算时保留高优先级块开头而非整块丢弃（codeAgent / keywordAgent / knowledgeRetrieval 共用 `buildUpstreamBlocks`）
- **执行状态 Checkpoint（断点续跑）** — 每层执行完成后把 `PipelineContext` 写盘到 `.pin/exec_state_<workflowId>.json`；上次暂停（如 Answer 节点等待输入）恢复运行时，自动跳过已完成节点从断点继续
- **21 种节点执行器** — 每种节点类型均有独立执行逻辑
- **智能体节点真实 AI API 调用** — 兼容 OpenAI/Anthropic/Ollama 格式（含火山方舟）
- **CodeAgent 双模式** — `analyze`（只读分析）/ `batch`（按 tasks.md 分批写代码，tasks.md 打勾续跑 + 批次 diff 落 `session/`）；批处理截断检测（达到迭代上限仍未完成 → analyze 报错、batch 不打勾不记 diff，保留中间输出）
- **Lark 节点 CLI 调用** — 通过 `lark-cli` 子进程执行读/写/创建操作
- **Answer 节点暂停/恢复** — 等待用户输入后继续执行
- **孤立节点过滤** — 无连线参与的节点不执行
- **执行控制** — 运行全部/重置/单节点执行/从 PIN 节点开始，实时状态标签
- **执行日志** — 按节点展示 info/warn/error 日志
- **输出面板** — 独立 Tab 展示各节点输出结果
- **执行信息统计** — 执行结果页展示执行是否成功 / 执行时间 / 总消耗 token
- **节点输出固定（PIN）** — 保存节点执行结果到文件（按工作流分目录），支持从 PIN 节点开始执行，避免重复运行上游节点，并恢复该节点执行时的累积上下文

### 5. 模型管理
- **模型 CRUD** — Table 展示 + Modal 创建/编辑，数据持久化到 `model.conf.json`
- **模型字段** — 名称/描述/模型名/API URL/API Key/Token 范围
- **工作流集成** — 智能体/代码处理节点编辑面板可选择模型

### 6. 提示词管理
- **提示词编辑** — 独立 Tab 页面，支持修改 CodeAgent 系统提示词等模板
- **持久化** — 保存到 `prompts/` 目录

### 7. 工作流导入/导出/模板
- **导入** — 弹窗支持粘贴 JSON 或拖拽上传 JSON 文件
- **导出** — 弹窗展示 JSON（可复制）或下载为 `.json` 文件
- **保存模板** — 保存到 `workflows/` 目录，持久化存储
- **工作流管理** — 独立 Tab 页面，列表展示所有已保存模板，支持加载/删除

### 8. 节点输出固定（PIN）
- **PIN 按钮** — 每个节点执行后点击 📌 保存输出到 `workflows/result/.pin/<工作流名>/nodeType_nodeId.json`（按工作流目录隔离，不同工作流相同 nodeId 不互相覆盖）
- **上下文随 PIN 保存** — 对运行过的节点 PIN 时，从执行记录中提取该节点执行时看到的累积上下文（上游祖先输出）一并保存；从中间 PIN 运行时可恢复完整上下文（如原始需求 + 最终交付物的比对）
- **Load 加载** — 编辑面板可选择已保存的 PIN 数据加载到内存，按 nodeId 精确注入，同一类型不同节点互不干扰；当前工作流的 PIN 排在前面，其他工作流排后面并标注归属
- **从 PIN 执行** — 执行面板 Select 选择 PIN 节点后运行，跳过上流节点，从该节点下游开始；未运行过的节点 PIN 无累积上下文，直接运行（不累积）

### 9. 状态管理
- **Zustand** 全局状态管理
- **Immer** 不可变数据更新（`patchCurrentNode`），避免深层 spread
- **NodeBuilder** 工厂模式构建节点，自动生成 UUID 和位置偏移
- **路由树自动生成** — TanStack Router 文件路由，`tsr generate` 自动更新

### 10. BMad集成与角色使用

**策略：只取「多角色」，自建编排，不跑 BMad CLI**

BMad CLI（`npx bmad-method install` 部署的完整框架）定位是 AI IDE 内的交互式多 Agent 协同：Core 后台调度、BMM 定义全流程角色、TEA 提供测试门禁、BMB 用于扩展新 Agent。它把整个 SDLC 固化成一套交互式会话流程（激活 → 人格 → 菜单技能派发）。

本项目用可视化 DAG 引擎**自编编排**，需要的只是 BMad Method 的**多角色 persona 能力**。因此不把 BMad CLI 作为运行时，只抽取角色定义与角色指令，接入自己的节点体系。

**角色资产与目录结构**

| 路径 | 内容 | 用途 |
|------|------|------|
| `.bmad/_bmad/config.toml` | 角色注册表（7 个：analyst / pm / ux-designer / architect / dev + tech-writer / tea） | 角色库数据源，`/api/bmad/agents` 解析 |
| `.bmad/agents/<id>/SKILL.md` | 清洗后的角色 persona 指令（自包含、无运行时协议） | **注入用**，规则页可直接编辑 |
| `.bmad/agents/<id>/customize.toml` | 官方 persona 源（role / identity / communication_style / principles） | 源参考，清洗时提炼 |
| `.bmad/plan/` | 官方 plan 技能（PRD / spec / architecture / ux 等）备份 | 暂不接入执行，保留作方法论参考 |

**为什么要「清洗」**

官方角色的 SKILL.md 是**运行时协议壳**：包含 `uv run .../resolve_customization.py`、`_bmad/custom/*.toml` 覆盖合并、`config.yaml` 加载、`{agent.menu}` 交互式菜单等，全部依赖 BMad 安装产物。本项目没有对应脚本/配置，直接注入会引导模型"执行不存在的脚本、展示菜单"。清洗 = 保留 description / Overview + customize.toml 的 persona 字段 + 任务约束，**删除全部运行时协议**。清洗后每个角色的指令完全自包含，可在平台直接编辑。

**注入链路**

```
config.toml → /api/bmad/agents（解析角色 + 附 skillContent = SKILL.md 全文）
  → 节点选择角色 → roleDescription = skillContent || description
  → bmadExecutor 输出 instructions → 下游智能体以 systemPrompt（优先级 20）注入
```

**节点应用**

- **BMad 角色节点** — 纯 persona 注入，不调用 AI，把角色指令传给下游智能体
- **智能体节点** — 下拉选择角色（或连线 BMad 节点），自动同步角色指令 + 模型配置
- **自检节点** — 选择评审视角角色，独立会话以该角色身份评审（一个节点一个角色，多视角 = 多个自检节点）
- **规则页** — 角色库表格 + 「自定义 BMad 角色」（自动生成初始指令文件）+ 「指令」列直达编辑器

**对比 BMad CLI：取舍分析**

| 维度 | 本项目（persona 注入 + 自建编排） | BMad CLI（完整框架） |
|------|---------------------------------|----------------------|
| 编排方式 | 可视化 DAG 自由编排，可组合知识库 / Lark / 记忆 / 条件 / 循环等自有节点 | 内置固定 SDLC 流程（PRD→UX→架构→故事→开发→评审→测试），交互式会话驱动 |
| 运行时依赖 | 无：只读 `.bmad/` 下配置与指令，不需要 install 产物 / python 脚本 / config.yaml | 需 install 部署 Core / BMM / TEA / BMB，依赖 uv / python 脚本 |
| 角色能力 | 提炼 persona（身份 / 沟通风格 / 行为准则 / 任务约束），注入为 system prompt | 完整交互式 Agent（激活步骤 / 持久事实 / 菜单技能派发 / 多 Agent 协同） |
| 流程方法深度 | 目前只注入角色人格；plan 流程模板仅保留未接入 | 完整方法论（PRD Discovery/Finalize、架构 spine、Reviewer Gate、测试策略、CI 门禁） |
| 可调试性 | 单节点执行 / PIN / 日志 / 上下文预算可控，所见即所得 | CLI 交互黑盒，流程不可拆分调试 |
| 可扩展性 | 自定义角色可视化创建 + 指令内编辑，与模型管理（多供应商）集成 | BMB 元开发可搓新 Agent / 工作流，但仍在框架内 |
| 维护成本 | 官方更新需手动同步 `.bmad/` 并重新清洗 | 每次 install 自动拉最新，但受框架约束 |
| 适用场景 | 把「角色 / 多视角」嵌入自研工作流编排，轻量、本地、可调试 | 直接采用 BMad Method 完整流程，接受固定编排 |

**结论**

核心取舍是**「只要多角色，不要框架」**。BMad Method 最可复用的资产是多年沉淀的角色方法论（分析师 / 产品 / 架构 / 开发 / 测试的职责与准则）；CLI 的价值在于把流程固化为会话。本项目诉求是"自编工作流去执行"，角色提供的是视角与约束（含多角色评审），因此 persona 注入是最小契合面。代价是放弃官方流程模板的方法论深度与自动更新——后续可按需把 `.bmad/plan/` 中的核心流程（如 PRD 方法论）提炼进角色指令或节点模板。

> 注：`/api/execute/bmad` 为早期「CLI 映射」方案的遗留路由（status / skills / map-workflow / execute-skill），当前主链路不使用，仅保留兼容。

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
│   └── executors/            # 21 种节点执行器
│       ├── index.ts          # 执行器注册表
│       ├── userInput.ts
│       ├── agent.ts          # AI 智能体调用
│       ├── bmad.ts          # BMad 角色（persona 注入，不调用 AI/CLI）
│       ├── lark.ts           # Lark 文档
│       ├── larkTemplate.ts   # Lark 模板
│       ├── larkWikiTraversal.ts  # Lark Wiki 遍历
│       ├── answer.ts         # 回答/暂停
│       ├── aiOutput.ts
│       ├── if.ts             # 条件分支
│       ├── loop.ts           # 循环
│       ├── retry.ts          # 重试
│       ├── codeAgent.ts      # CodeAgent（analyze/batch 双模式 + App-Desc）
│       ├── taskPlanner.ts    # 任务拆解
│       ├── selfCheck.ts      # 自检 Agent（独立会话评审）
│       ├── keywordAgent.ts   # 关键词提取
│       ├── knowledgeRetrieval.ts  # 知识库检索
│       ├── knowledgeStore.ts # 知识库存储
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
├── services/                # 共享服务（前后端共用）
│   ├── ai.ts                # AI 调用封装（callAI，返回 text + token 用量）
│   ├── upstreamContext.ts   # 上游累积上下文构建（优先级排序 + 预算截断）
│   ├── specFolder.ts        # Spec 产物读写（spec.md / plan.md / tasks.md）
│   ├── taskManager.ts       # tasks.md 解析 / 打勾 / 取批次（前后端共用纯函数）
│   ├── modal.ts             # 模型配置 strip/hydrate（敏感参数不落盘，仅存 { id, alias }）
│   └── embedding.ts         # 向量化（getEmbeddings）
├── store/
│   └── node.ts               # Zustand 全局状态
├── types/
│   ├── index.ts              # 类型定义 & NodeTypes 常量
│   └── builder.ts            # NodeBuilder 工厂
├── routes/
│   ├── __root.tsx
│   ├── index.tsx             # 首页（画布+编辑+执行面板）
│   └── api/
│       ├── workflows.ts      # 工作流 CRUD（含版本快照）
│       ├── model.ts          # 模型管理
│       ├── prompts.ts        # 提示词管理
│       ├── memory.ts         # 记忆管理
│       ├── skill.ts          # Skill 管理
│       ├── bmad/agents.ts    # BMad 角色库
│       ├── editor/           # 文件编辑器
│       ├── execute/          # 执行 API
│       │   ├── agent.ts          # AI 调用
│       │   ├── codeAgent.ts      # CodeAgent（analyze/batch + App-Desc）
│       │   ├── taskPlanner.ts    # 任务拆解
│       │   ├── selfCheck.ts      # 自检 Agent（材料按 Spec/git/上游 自动降级）
│       │   ├── keywordAgent.ts   # 关键词提取
│       │   ├── lark.ts           # Lark CLI
│       │   ├── larkWikiTraversal.ts  # Lark Wiki 遍历
│       │   ├── bmad.ts           # BMad（遗留 CLI 路由，已不主用）
│       │   ├── specFolder.ts     # Spec 产物读写（含路径穿越防护）
│       │   ├── qdrant.ts / embed.ts / doc-process.ts   # 知识库（检索/向量化/文档处理）
│       │   ├── fileWrite.ts      # 文件写入（路径限定，防 AI 越界）
│       │   └── models.ts         # 模型执行入口
│       └── workflow/
│           ├── pin.ts        # PIN 固定 (GET/POST/DELETE，按工作流分目录)
│           ├── exec-state.ts # 执行状态 Checkpoint（断点续跑）
│           ├── exec-history.ts  # 执行历史
│           └── versions.ts   # 版本快照
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
# BMad 无需安装 CLI —— 仅使用 .bmad/ 下的角色配置与指令（见「10. BMad集成与角色使用」）
```

---

## 核心节点详解

### CodeAgent 节点
AI 自主探索本地代码仓库的节点，使用 Vercel AI SDK 的 `generateText` + Tool Calling，支持双模式：
- **analyze 模式（默认）** — 只读探索 + 分析，工具 `listDirectory` / `readFile` / `runGitLog`，产出技术方案文档
- **batch 模式** — 按 tasks.md 批次执行代码生成，工具新增 `writeFile` / `editFile` / `gitDiff`（**路径强制限定在项目根目录内**，防 AI 越界写文件）；每批完成后 tasks.md 打勾（`- [ ]` → `- [x]`，重跑自动跳过已完成批次）+ 批次 diff 记录到 `specRoot/session/batch-<N>.md`
- **配置**：项目路径、Git 分支、分析指令、最大迭代次数、模型选择、模式切换（analyze/batch）、应用地图 Switch
- **应用地图（App-Desc）**：analyze 时检测项目根目录 `app-desc.json`——有则注入（含 new/transition/old zone 约束），没有则扫描仓库生成初版写回项目；batch 只读注入，没有则跳过不生成
- **批处理截断检测** — 达到最大迭代次数仍在工具调用时判定未完成：analyze 报错提示、batch 不打勾不记 diff，并保留中间输出（`response` 为空串）
- **上游集成** — 接收上游 Agent 输出的需求分析（response）作为分析依据，并可从祖先链（upstreams）回溯获取 Lark 模板（templateContent）约束最终输出格式；模板节点不在直接前驱时也能拿到

### 自检 Agent 节点（selfCheck）
独立会话 · 独立上下文 · 不共享编码 Agent 记忆（防"自己给自己打分"的确认偏差）：
- **身份注入** — 编辑面板「视角 (BMad)」从 BMad 角色库选择一个角色，直接注入该角色 SKILL 作为评审系统提示词；**一个节点一个角色**，多视角检验 = 创建多个自检节点各配一个角色
- **材料自动降级**（见 `/api/execute/selfCheck` 的 `collectMaterials`）：
  1. **Spec 模式** → Spec 产物（spec.md / plan.md / tasks.md）
  2. **常规 + 上游为 codeAgent** → git diff（ground truth，不回退到 agent 自述；缺项目路径时报错引导配置）
  3. **常规 + 其他上游** → 全部上游祖先节点的累积产物（原始需求 + 最终交付物，由模型逐条比对打分）
- **结论** — 报告写 `check_reports/check_summary.md`；节点显示 PASS / CONDITIONAL_PASS / FAIL 标签 + 视角角色

### 任务拆解节点（taskPlanner）
把 plan.md / 上游概设输出拆解为可独立执行的 batch 任务清单：
- **Schema** — `## Batch N` + `- [ ] T-NN`，每个任务绑定「文件 / 前置 / 验收」三要素（结构化校验，缺失返回 422）
- **输出** — tasks.md 全文 + batchCount / taskCount / warnings，供 codeAgent batch 模式按批次消费

### Spec 模式（端到端交付）
- 节点通过脚印按钮（StepMarkNode）手动标记输出归属阶段产物（spec/plan/tasks/report/…），画布左侧 StepLinePanel 汇总步骤并提示缺失必选项
- 引擎执行时按标记把节点输出写入 `specs/<需求名>_<时间戳>/` 对应产物文件；`session/conversation-log.md` 全量黑匣子始终记录
- 执行前检测执行范围内至少一个节点标记了阶段产物，否则中止

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
1. 执行节点后点击 📌 保存结果（连同该节点执行时看到的累积上下文，按工作流分目录落盘）
2. 执行面板 Select 选择已固定的 PIN 节点（当前工作流的 PIN 排在前面）
3. 点击「运行」→ 引擎注入 PIN 输出（并恢复其累积上下文），从下游节点继续执行
4. 未运行过的节点 PIN 无累积上下文 → 直接运行，不累积

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
- 文件存储 `workflows/result/.pin/<工作流名>/nodeType_nodeId.json`，**按工作流目录隔离**（不同工作流相同 nodeId 不互相覆盖）；注入按 `nodeId` 精确匹配，同一类型不同节点互不干扰
- PIN 保存时记录该节点执行时的累积上下文（`context.upstreams`）；从中间 PIN 部分运行时一并注入，下游节点可恢复完整上下文累积
- 加载列表按"当前工作流优先"排序并标注归属；旧格式（根目录文件）仍兼容读取

---

## 设计哲学

本项目聚焦于 **轻量、本地、可调试** 的工作流编排：

- **不构建通用平台**，只解决"BMad+飞书文档+代码分析"的特定场景
- **编辑器即运行时**，所见即所得，支持单节点调试
- **PIN 机制** 满足迭代调试场景，避免重复消耗 Token
- **文件路由 + API 路由一体化**，前后端同仓库，零部署复杂度
