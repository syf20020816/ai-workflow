---
title: 简单Spec
order: 11
---

# 简单Spec（Spec）

Spec 格式（简化版，无需安装框架）。

## 目录结构

zip 包内目录结构（根据导出格式使用对应目录）：

```text
├── spec/                                 # Spec 格式（简化版，无需安装框架）
    └── changes/my-workflow/
        ├── inputs/...                    # 输入物，结构与 Specify 一致
        ├── skills/...
        ├── bmad/...
        ├── memory/...
        ├── knowledge/...
        └── specs/my-workflow/
            └── workflow.yaml            # 工作流定义（artifacts 依赖图）
        # 运行时在此层生成：spec.md / plan.md / tasks.md 等产物文件
```


## Spec 格式（workflow\.yaml）

Spec 格式导出为 `spec/changes/<name>/` 目录，与 OpenSpec 同构的 artifacts 依赖图，但**只认用户手动标注的 specStep**，不做任何推断补充（无类型兜底、无 tasks 自动补全）。无需安装任何框架，解压后把 `spec/` 目录交给任意 AI agent 即可按 workflow\.yaml 执行。

### 与 OpenSpec 的差异

| 维度             | OpenSpec                                | Spec                                            |
| -------------- | --------------------------------------- | ----------------------------------------------- |
| artifact id 命名 | 映射命名（plan→design、spec→proposal）         | 直接用 specStep key（plan→`plan.md`、spec→`spec.md`） |
| 未标注节点          | 类型兜底产出 artifact（agent→proposal）         | 跳过，只认手动标注                                       |
| lark write 挂接  | 无需标注即挂接                                 | 必须标注 specStep 才挂接                               |
| tasks 自动补全     | 链尾自动补全                                  | 不补全，需用户手动标注                                     |
| apply 段        | 有（`/opsx:apply` 跟踪）                     | 无                                               |
| 所需框架           | 需安装 OpenSpec CLI 或 agent 支持 `/opsx:*`   | 无需安装，任意 agent 直接读 yaml                          |
| 执行方式           | 通过 `/opsx:propose` / `/opsx:apply` 命令触发 | 直接把 workflow\.yaml 交给 agent 告知按 artifacts 顺序执行  |

### 放置目录

将解压后的 `spec/` 目录放置到项目根目录下：

```text
spec/
└── changes/<name>/
    ├── inputs/...                    # 输入物
    ├── skills/...
    ├── bmad/...
    ├── memory/...
    ├── knowledge/...
    └── specs/<name>/
        └── workflow.yaml            # 工作流定义
    # 运行时在此层生成：spec.md / plan.md / tasks.md 等产物文件
```

### 执行工作流

把 `spec/` 目录交给任意 AI agent（如 Claude Code、Trae、Copilot、Cursor 等），告诉它：

> 请按照 `spec/changes/<name>/specs/<name>/workflow.yaml` 中的 artifacts 定义顺序执行。
> 先读取 `instruction` 字段，理解要做什么，然后按 `requires` 依赖顺序逐个生成产物文件。
> 产物文件落盘到 `spec/changes/<name>/` 目录下。

执行流程：

1. agent 读取 `workflow.yaml`，理解 `artifacts` 依赖图
2. 按 `requires` 依赖顺序逐个生成产物（`spec.md` → `plan.md` → `tasks.md` 等）
3. 每个 artifact 的 `instruction` 就是执行指令，`## 输入上下文` 列出可引用的输入物文件
4. 产物文件落盘到 `spec/changes/<name>/` 目录下

### 产物落盘

```text
spec/changes/<name>/
├── spec.md                 # 功能规格
├── plan.md                 # 技术方案
├── tasks.md                # 分批次任务清单
├── report.md               # 自检报告（如有标注）
└── ...
```

### 输入物使用

与 Specify 格式结构一致（路径前缀为 `spec/changes/<name>/`），AI 助手在生成产物时按 `instruction` 中的指引读取这些文件作为上下文。