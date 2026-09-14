---
title: Speckit
order: 13
---

# Speckit

Speckit 是一个基于 spec-kit 的工作流执行工具，支持指定工作流执行顺序、门禁、分支、循环等控制流。

## 目录结构

zip 包内目录结构（根据导出格式使用对应目录）：

```
├── specify/workflows/my-workflow/     # Specify 格式
│   ├── workflow.yml                   # 主工作流文件
│   ├── inputs/                        # 输入物
│   │   ├── user-input/<node>.md       # 用户输入内容 + 提示词
│   │   ├── user-input/<node>/files/   # 上传文件（可能为占位）
│   │   └── urls.md                    # URL 链接清单（含 Lark 引用）
│   ├── skills/<skillId>/SKILL.md      # Skill 节点文件
│   ├── skills/lark-cli/SKILL.md       # Lark 使用技能指引
│   ├── bmad/agents/<agent>.md        # BMad 角色定义
│   ├── memory/memory.md              # 记忆文件
│   └── manifest.json                 # 导出清单
```

## Specify 格式（workflow\.yml）

Specify 格式导出为单一 `workflow.yml` 文件，由 spec-kit 引擎按步骤顺序执行，适合有明确控制流（门禁、分支、循环）的工作流。

### 执行工作流

```bash
# 运行工作流
specify workflow run ./specify/workflows/my-workflow/workflow.yml \
  --input spec="你想要的实现功能描述"

# 指定集成（默认 auto）
specify workflow run ./workflow.yml \
  --input spec="..." \
  --input integration=claude
```

执行流程：

1. 按 `workflow.yml` 中的 `steps` 顺序依次执行
2. 遇到 `gate` 步骤暂停，等待人工审批后 `resume`
3. 遇到 `shell` 步骤自动执行 shell 命令
4. 遇到 `command` 步骤调用 speckit 命令生成产物

### 3.2 运行状态与恢复

```bash
# 列出所有运行
specify workflow status

# 查看某个 run 的详细状态
specify workflow status <run_id>

# 从 gate 暂停点恢复
specify workflow resume <run_id>

# 从失败步骤恢复
specify workflow resume <run_id> --from-failed

# 恢复时携带审批结果
specify workflow resume <run_id> --option approve
```

### 产物落盘

执行过程中，各步骤生成的产物落盘到工作流目录同级：

```text
specify/workflows/my-workflow/
├── workflow.yml        # 原始定义
├── spec.md             # spec 步骤产物
├── plan.md             # plan 步骤产物
├── tasks.md            # tasks 步骤产物
├── design.md           # data-model/contracts 等
└── ...
```

### 输入物使用

#### userInput 节点

`inputs/user-input/<node>.md` 包含用户在编排时输入的文字和提示词。

- 如果 `spec.md` 等产物已在导出时从 userInput 静态生成（workflow 有 `shell: cp` 步骤），可直接使用

- 否则手动将内容复制到第一阶段产物，或修改 workflow\.yml 引用文件

#### 上传文件

`inputs/user-input/<node>/files/` 下为上传文件。

- 如果文件内容未持久化，zip 中为占位文件（标记 `<!-- 文件内容未持久化 -->`）

- 需在本地手动补充对应文件

#### Skill 节点

`skills/<skillId>/SKILL.md` 是技能说明文件，workflow\.yml 中的对应步骤会自动引用。

#### BMad 角色

`bmad/agents/<agent>.md` 是角色定义文件（系统提示词 + 职责描述），workflow\.yml 中的步骤引用这些文件作为 context。

#### 记忆文件

`memory/memory.md` 是持久化的工作记忆，workflow 中的 `memory` 步骤会自动读取。

#### Lark 文档引用

`inputs/urls.md` 包含工作流引用的所有 Lark 文档 URL 链接。

`skills/lark-cli/SKILL.md` 是 lark-cli 使用指引：

```bash
# 读取 Lark 文档内容（markdown 格式）
lark-cli docs +fetch \
  --doc "https://xxx.feishu.cn/docx/xxx" \
  --doc-format markdown \
  --jq '.data.document.content'
```

#### Lark 知识库快照

`inputs/lark/wiki/<spaceName>.md` 包含知识库全量文档快照（上限 200 篇），可直接引用或全文搜索。

#### 知识库检索产物

`knowledge-retrieval.md` 为知识库检索节点的产物：本地模式是使用你本机 AI CLI 的 MCP 连接你自己配置的知识库检索（可挂 SKILL 指令）得到的原始内容；远程 API 模式是直接调用你配置的知识库接口（URL / 方法 / Headers / Body）后整理保存的响应内容。产物保留出处与关键信息，可直接作为下游 LLM 上下文。

### 高级用法

#### 外部文档作为 spec 产物

如果工作流中存在 Lark 节点标注了 `specStep`（如 lark 文档标注为 `plan`），导出的 workflow\.yml 会包含 `shell` 步骤自动拉取文档：

```yaml
- id: fetch-plan
  type: shell
  run: >-
    lark-cli docs +fetch --doc "https://xxx.feishu.cn/docx/xxx"
    --doc-format markdown --jq '.data.document.content' > plan.md
  timeout: 60
```

确保已安装 lark-cli 并登录，该步骤会自动执行。

#### 并行步骤合并

如果导出时勾选了「合并并行步骤」，同一拓扑层中完全相同的 command 步骤会合并为单个 step，减少 token 消耗。

#### 修改工作流

直接编辑 `workflow.yml` 即可调整步骤：

```yaml
steps:
  - id: my-step
    command: speckit.plan
    model: "DoubaoSeed2.1"    # 指定模型
    input:
      args: "{{ steps.specify.output.file }}"
```

支持 11 种 step 类型：`command`、`prompt`、`shell`、`gate`、`init`、`if`、`switch`、`while`、`do-while`、`fan-out`、`fan-in`。