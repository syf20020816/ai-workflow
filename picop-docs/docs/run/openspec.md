---
title: OpenSpec
order: 12
---

# OpenSpec 格式（schema.yaml）

OpenSpec

## 目录结构

zip 包内目录结构（根据导出格式使用对应目录）：

```
├── openspec/                            # OpenSpec 格式
│   ├── config.yaml                      # 默认 schema 配置（schema: <name>）
│   ├── schemas/my-workflow/
│   │   ├── schema.yaml                  # 工作流 schema
│   │   └── inputs/...                   # 输入物，结构与 Specify 一致
│   └── changes/
│       └── archive/                     # 变更归档目录
```

## 4. OpenSpec 格式（schema.yaml）

OpenSpec 格式导出为 `openspec/` 目录：`schemas/<name>/schema.yaml`（工作流定义）+ 同级 `inputs/`（输入物）+ `config.yaml`（默认 schema 配置）。**schema.yaml 不是由引擎自动执行的，而是由 AI agent 读取并理解后，按 artifacts 依赖图逐个生成产物。**

### 4.1 执行原理

```
schema.yaml 定义 artifacts 依赖图
    │
    ▼
AI agent 读取 schema.yaml，理解 artifacts 顺序
    │
    ▼
agent 按 requires 依赖逐个生成产物文件（proposal.md → design.md → tasks.md）
    │
    ▼
agent 读取 schemas/<name>/inputs/ 目录下的输入物作为上下文
    │
    ▼
产物落盘到 openspec/changes/<name>/
```

关键区别：

- **Specify 格式**：有 `specify workflow run` 运行时引擎，steps 自动执行，gate 自动暂停

- **OpenSpec 格式**：**没有运行时引擎**，`schema.yaml` 是给 AI agent 读的声明式指令，由 agent 理解并执行

### 4.2 何时触发执行

OpenSpec 工作流不是自动执行的，需要在 AI 聊天中通过**用户主动输入斜杠命令**触发：

| 触发时机       | 命令                     | 作用                     |
| ---------- | ---------------------- | ---------------------- |
| 开始一个新功能/变更 | `/opsx:propose <name>` | 创建变更目录，按 schema 生成全套产物 |
| 实施任务清单     | `/opsx:apply`          | 按 tasks.md 逐步实施        |
| 验收后归档      | `/opsx:archive <name>` | Delta 合并到 specs/ 真相源   |

**触发条件**：agent 工具（如 Claude Code、Copilot、Trae 等）必须内置了 OpenSpec 协议支持（即识别 `/opsx:*` 命令并理解 `artifacts`/`requires`/`generates` 语义），否则 schema.yaml 只是一个普通 YAML 文件。

### 4.3 放置与配置

将解压后的 `openspec/` 目录放置到项目根目录下。导出 zip 已按 OpenSpec 目录约定组织，无需手动搬移：

```text
openspec/
├── config.yaml                      # 内容为 schema: <name>，指定默认 schema
├── schemas/<name>/schema.yaml       # 工作流定义（OpenSpec 从该目录发现 schema）
└── changes/
    └── archive/                     # 变更归档目录
```

```bash
# 验证 schema 是否可识别
openspec schema which <name>

# 验证 schema 结构与模板
openspec schema validate <name>
```

> 如果目标项目尚未初始化 OpenSpec，先执行 `openspec init`，再将导出的 `openspec/` 内容合并进去。

### 4.4 执行工作流

在 AI 聊天中通过斜杠命令驱动执行：

```text
# 用户输入斜杠命令 → agent 读取 schema.yaml → 按依赖图生成产物
# 产物文件按 schema.yaml 中 artifacts 定义的 generates 字段落盘
/opsx:propose my-workflow

# 按 tasks.md 实施
/opsx:apply

# 归档完成变更（Delta 合并到 specs/ 真相源）
/opsx:archive my-workflow
```

执行流程：

1. 用户输入 `/opsx:propose my-workflow`
2. agent 读取 `openspec/schemas/my-workflow/schema.yaml`
3. 按 `artifacts[].requires` 解析依赖顺序（无依赖的 artifact 先生成）
4. 按顺序读取每个 artifact 的 `instruction`，将其作为 AI 生成指令
5. 生成产物文件写入 `openspec/changes/my-workflow/<generates>`
6. 产物落盘后，用户可查看并继续 `/opsx:apply` 实施

### 4.5 产物落盘

执行过程中，各 artifact 按 schema 定义顺序生成，产物落盘到 `openspec/changes/my-workflow/`：

```text
openspec/changes/my-workflow/
├── proposal.md          # 提案产物
├── design.md            # 设计产物
├── tasks.md             # 任务清单产物
└── specs/               # 增量规格目录
    └── <domain>/
        └── spec.md

# 输入物在 schema 目录下（非变更产物目录）：
# openspec/schemas/my-workflow/inputs/...
```

导出器对处理节点与输出节点的映射规则：

- **处理节点**（agent / codeAgent / taskPlanner / selfCheck 等）产出生成型 artifact，instruction 由节点配置翻译，并自动列出上游输入物的引用路径（`## 输入上下文`）；

- **lark write 节点**（`action: write`）不产出独立 artifact，而是把「生成后用 `lark-cli docs +update --command overwrite/append` 写入目标文档」的投递指令追加到上游处理节点的 instruction（`## 产物投递`）；

- **BMad 角色节点**不产出 artifact，角色约束注入下游处理节点的 instruction 头部（`## 角色`）；

- 画布上没有 tasks 产物节点时，导出器自动在链尾补全 `tasks` artifact，`apply` 跟踪 `tasks.md`，保证 `/opsx:apply` 可执行。

### 4.6 输入物使用

#### 静态输入（userInput / BMad / Memory）

`openspec/schemas/<name>/inputs/` 目录下的文件与 Specify 格式结构一致（路径前缀不同），AI 助手在生成产物时按 `instruction` 中的指引读取这些文件作为上下文。

#### Lark 文档引用

`openspec/schemas/<name>/inputs/urls.md` 中的 Lark 文档 URL 由 AI 助手根据 `lark-cli` 技能指引自行拉取。schema 中对应 artifact 的 `instruction` 字段会包含拉取指引：

```yaml
- id: plan
  generates: design.md
  instruction: |
    使用 lark-cli 拉取文档内容
    （lark-cli docs +fetch --doc "https://xxx.feishu.cn/docx/xxx" --doc-format markdown）
    并原样保存为 design.md，不要自行生成或改写内容。
```

#### 知识库快照

`openspec/schemas/<name>/knowledge/<collection>.md` 由 AI 助手在生成相关产物时自动读取。

### 4.7 自定义 schema

如需调整 artifact 依赖关系或指令，直接编辑 `openspec/schemas/<name>/schema.yaml`：

```yaml
artifacts:
  - id: proposal
    generates: proposal.md
    instruction: |
      Create a proposal explaining WHY this change is needed.
      Focus on the problem, not the solution.
    requires: []

  - id: design
    generates: design.md
    instruction: |
      Create a design document explaining HOW to implement.
    requires: [proposal]

  - id: tasks
    generates: tasks.md
    requires: [design]

apply:
  requires: [tasks]
  tracks: tasks.md
```