# AI Workflow — 轻量级 AI 工作流可视化编排工具

基于 [BMad Method](https://bmadcodes.com/) + Qdrant + Lark CLI 构建的轻量化 AI 工作流引擎，提供可视化节点编排能力，适合需要快速搭建 AI Agent 工作流的场景，避免 Dify 等重型平台的复杂性。

---

## ✨ 已实现功能

### 1. 可视化工作流编辑器
- **[React Flow](https://reactflow.dev/) 画布** — 节点拖拽、连线、缩放、平移，基于 `@xyflow/react` v12
- **MiniMap** + **Controls** — 小地图导航和画布控制
- **暗色主题** — Ant Design darkAlgorithm + React Flow 暗色适配
- **节点选中高亮** — 选中节点蓝色边框 (`.node_choose`)

### 2. 6 种工作流节点
| 节点类型 | 标识 | 用途 | 编辑面板 |
|---------|------|------|---------|
| **用户输入节点** | `userInput` | 接受用户输入的文本、提示词、文件、URL | 文本/提示词/文件/URL 输入 |
| **智能体节点** | `agent` | 配置 AI 模型、API Key、Token 范围 | 模型 ID、API Key/URL、Token 范围 |
| **BMad 角色节点** | `bmadAgent` | 赋予智能体特定角色（分析师/架构师/SM 等） | 角色、描述、模型、温度、系统提示词 |
| **Lark 文档节点** | `lark` | 读取/写入/创建飞书文档 | 操作类型（读取/写入/创建）、文档 URL、内容 |
| **回答节点** | `answer` | 工作流暂停，等待用户输入 | 问题、预置选项 |
| **AI 输出节点** | `aiOutput` | 展示最终输出结果 | 输出内容（只读） |

### 3. 节点操作
- **添加节点** — 每个节点右侧的 `+` 按钮，下拉选择节点类型，自动生成连线到新节点
- **删除节点** — 编辑面板底部「删除」按钮，同时清理关联连线
- **节点属性编辑** — 右侧 300px 编辑面板，点击节点即切换
- **节点标题/描述编辑** — 编辑面板头部可编辑
- **节点拖拽** — 自由拖拽调整布局

### 4. 状态管理
- **Zustand** 全局状态管理
- **Immer** 不可变数据更新（`patchCurrentNode`），避免深层 spread
- **NodeBuilder** 工厂模式构建节点，自动生成 UUID 和位置偏移
- **节点连线约束** — 用户输入节点 → 仅能连接智能体节点；智能体节点 → 不可连接用户输入和自身

### 5. 技术栈
- **框架**: React 19 + TypeScript 6 + Vite 8
- **路由**: TanStack Router
- **UI**: Ant Design 6 + Radix UI Icons + Lucide Icons
- **画布**: React Flow 12 (`@xyflow/react`)
- **状态**: Zustand 5 + Immer 11
- **样式**: Sass (SCSS Modules)

---

## ⚠️ 潜在问题

### 1. 类型安全边界
- `NodeBuilder` 中的 `as any` 类型断言 — `AppNode`（即 `NodeProps<>`）与 React Flow 的 `Node` 类型不完全兼容，节点构造和添加时有多处 `as unknown as Node` 和 `as any` 转换。后续类型收敛后应清理。

### 2. 节点数据深层编辑
- EditItem 组件支持 `inputType: 'text' | 'textArea' | 'password' | 'number'`，但**文件上传**目前仅以字符串路径形式存储，缺少实际文件选择器
- EditItem 的 `value` 类型为 `string | number | File`，但 File 类型的处理尚未实现真实的文件选择 UI

### 3. 连线约束不完整
- `isDisabledNode` 仅定义了用户输入节点和智能体节点的约束规则，其他节点类型（Answer、BMad、Lark、AI Output）暂无条件约束，需根据实际业务流程补充

### 4. 无持久化
- 工作流数据仅存于 Zustand 内存中，刷新页面即丢失
- 缺少序列化/反序列化机制，无法保存和加载工作流

---

## 🚧 未完成（对比 Dify 的缺失）

### 核心引擎（最高优先级）

| 功能 | Dify | 本项目 | 优先级 |
|------|------|--------|--------|
| **工作流执行引擎** | 内置 DAG 执行器 | ❌ 未实现 | P0 |
| **节点运行时** | 每个节点有执行逻辑 | ✅ UI 已就绪，但 `RunNode` 按钮无实际行为 | P0 |
| **变量/上下文传递** | 节点间变量引用系统 | ❌ 未实现 | P0 |
| **工作流导入/导出** | JSON/YAML 序列化 | ❌ 未实现 | P1 |

### BMAD 集成（核心需求）

| 功能 | 状态 | 说明 |
|------|------|------|
| BMad CLI 调用 | ❌ 未实现 | 需要对接 `npx bmad-method` 命令，根据节点编排生成 BMad 指令 |
| BMad Agent 角色下发 | 🚧 半完成 | UI 可配置角色/模型/提示词，但未传递给 BMad 执行 |
| BMad 工作流映射 | ❌ 未实现 | 需要将画布上的节点编排转化为 BMad Method 的 planning → development 流程 |

### Qdrant 集成

| 功能 | 状态 | 说明 |
|------|------|------|
| Qdrant 向量存储 | ❌ 未实现 | 仅 docker-compose 中有 qdrant 服务，前端无对接 |
| 语义检索节点 | ❌ 未实现 | 缺少「知识库检索」节点类型 |
| 文档向量化 | ❌ 未实现 | 需要接入 embedding 模型将文档写入 Qdrant |

### Lark CLI 集成

| 功能 | 状态 | 说明 |
|------|------|------|
| Lark 节点 UI | ✅ 已完成 | 操作类型/URL/内容编辑 |
| Lark CLI 调用 | ❌ 未实现 | 需要调用 `lark-cli` 实际执行读/写/创建操作 |
| 文档内容展示 | ❌ 未实现 | 读取结果未在 UI 中展示 |

### 工作流编排

| 功能 | 状态 | 说明 |
|------|------|------|
| **条件分支** | ❌ 未实现 | Dify 有条件分支节点，本项目无 |
| **循环/迭代** | ❌ 未实现 | 无循环节点 |
| **代码节点** | ❌ 未实现 | 无自定义代码执行能力 |
| **HTTP 请求节点** | ❌ 未实现 | 无 API 调用节点 |
| **并行执行** | ❌ 未实现 | 所有节点串行 |
| **错误处理** | ❌ 未实现 | 无重试、超时、异常分支机制 |
| **运行日志** | ❌ 未实现 | 无执行日志/调试面板 |
| **版本管理** | ❌ 未实现 | 无工作流版本历史 |

### 其他

| 功能 | 状态 | 说明 |
|------|------|------|
| 用户认证 | ❌ 未实现 | 单机模式 |
| API 接口 | ❌ 未实现 | 无可调用的外部 API |
| 知识库管理 | ❌ 未实现 | 无文档上传/管理界面 |
| 多语言 | ❌ 未实现 | 仅中文硬编码 |

---

## 🎯 设计哲学（与 Dify 对比）

```
┌────────────────────────────────────────────────────────────┐
│                   Dify（重型平台）                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ 知识  │ │ 插件  │ │ 应用  │ │ 监控  │ │ 团队  │ → 全功能   │
│  │ 库管理│ │ 市场  │ │ 发布  │ │ 日志  │ │ 协作  │   平台     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│              本项目（轻量·专注核心流程）                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ BMad     │ │ Qdrant   │ │ Lark CLI │ → 三合一工作流      │
│  │ 方法驱动  │ │ 向量记忆  │ │ 文档接入  │   编排              │
│  └──────────┘ └──────────┘ └──────────┘                   │
│  核心差异：                                                 │
│  - 不构建通用平台，只解决"BMad+知识库+飞书文档"的特定场景      │
│  - 利用 BMad Method 的 Agentic Agile 方法论，非自研编排引擎  │
│  - 轻量到可以在本地开发环境中直接运行，无需服务器部署           │
└────────────────────────────────────────────────────────────┘
```

### 建议后续路线

1. **P0** — 实现工作流执行引擎（节点遍历 + 数据传递）+ BMad CLI 调用
2. **P0** — 实现 `RunNode` 按钮触发单节点调试执行
3. **P1** — Qdrant 向量检索节点（对接本地 Qdrant 服务）
4. **P1** — Lark CLI 节点实际对接（调用 `lark-cli` 读/写/创建文档）
5. **P1** — 工作流 JSON 序列化（保存/加载）
6. **P2** — BMad 全流程映射（将画布编排转换为 BMad Method 的 planning → sprint → development 循环）

---

## 🛠 本地开发

```bash
# 安装依赖
npm install        # 或 pnpm install / yarn

# 启动开发服务器（端口 3030）
npm run dev

# 生成路由
npm run generate-routes

# 生产构建
npm run build
```

### 依赖服务（Docker）

```bash
# 启动 Qdrant
docker compose up qdrant -d

# Lark CLI 需在宿主机独立运行
# BMad 需在宿主机独立运行（npx bmad-method install 后可用）
```

---

## 📁 项目结构

```
src/
├── components/
│   ├── flow.tsx              # React Flow 画布
│   ├── node/
│   │   ├── index.tsx         # UNode 通用节点容器
│   │   ├── index.module.scss
│   │   ├── header/           # 节点标题/图标
│   │   ├── edge/
│   │   │   ├── add.tsx       # 添加节点按钮（Dropdown 菜单）
│   │   │   └── run.tsx       # 运行节点按钮（占位）
│   │   ├── user/input.tsx    # 用户输入节点
│   │   └── ai/
│   │       ├── agent.tsx     # 智能体节点
│   │       ├── answer.tsx    # 回答节点
│   │       ├── output.tsx    # AI 输出节点
│   │       ├── bmad/         # BMad 角色节点
│   │       └── lark/         # Lark 文档节点
│   ├── panel/
│   │   ├── edit.tsx          # 编辑面板（主容器）
│   │   ├── index.module.scss
│   │   └── edit/             # 各节点编辑组件
│   │       ├── item.tsx      # 通用编辑行
│   │       ├── userInput.tsx
│   │       ├── aiAgent.tsx
│   │       ├── aiAnswer.tsx
│   │       ├── aiOutput.tsx
│   │       ├── bmad.tsx
│   │       └── lark.tsx
│   └── svg/index.tsx         # SVG 图标集合
├── store/
│   └── node.ts               # Zustand 全局状态
├── types/
│   ├── index.ts              # 类型定义 & NodeTypes 常量
│   └── builder.ts            # NodeBuilder 工厂
├── routes/
│   ├── __root.tsx            # 根路由（主题脚本）
│   └── index.tsx             # 首页（画布+编辑面板）
├── router.tsx
├── routeTree.gen.ts
└── styles.css
```
