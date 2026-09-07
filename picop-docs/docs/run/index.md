---
title: 工作流执行
order: 10
---

# Picop 导出自定义工作流执行指南

> Picop 是一个可视化工作流编排平台，导出 zip 包后在本地即可执行自定义工作流。
>
> 导出 zip 支持三种目标格式，各自有独立的执行方式，请根据实际导出目标选择对应章节。

## 准备工作

### spec-kit CLI（Specify 格式需要）

```bash
uv tool install specify-cli
specify --version
```

> Spec 格式不依赖 spec-kit，可直接交给任意 AI agent 读取 workflow\.yaml 执行。
>
> doc: [speckit](https://github.com/github/spec-kit/blob/main/README.zh-CN.md)

### openspec CLI（OpenSpec 格式需要）

```bash
npm install -g @fission-ai/openspec@latest
openspec --version
```

> OpenSpec 格式需要 openspec CLI，可直接交给任意 AI agent 读取 workflow\.yaml 执行。
>
> doc: [openspec](https://openspec.dev/docs/installation)

### lark-cli（如果工作流引用了 Lark 节点）

```bash
npm install -g @lark-openapi/cli
lark-cli auth login
lark-cli auth status
```

> 如果工作流不包含 Lark 节点（`lark` / `larkTemplate` / `larkWikiTraversal`），可跳过 lark-cli 安装。


## 常见问题

### Q: 运行时报错 `speckit.xxx command not found`

A: 确保已安装 speckit 命令集：

```bash
specify extension add speckit
specify extension list
```

### Q: lark 节点拉取失败

A: 确认 lark-cli 已登录且文档 URL 可访问：

```bash
lark-cli auth status
lark-cli docs +fetch --doc "文档URL" --doc-format markdown --jq '.data.document.content' | head
```

### Q: Skill 文件未找到

A: 确认 zip 中包含对应 skill：

```bash
ls skills/
```

如果缺少，检查导出时 manifest.json 中是否有对应警告，然后在本地手动补充。

### Q: 知识库快照过大

A: 快照超过 2MB 时会在 manifest.json 中警告。可以：

- 在导出时选择「HTTPS API 访问」策略（需要平台 API 可访问）

- 或手动裁剪快照文件

### Q: 需要重新导出

A: 回到 Picop 平台修改工作流后重新导出 zip，覆盖本地目录即可。

### Q: Spec 格式的 workflow\.yaml 无法被 agent 识别

A: 确认 agent 工具支持读取 YAML 文件并按 `artifacts` 依赖图执行。大多数 AI agent（Claude Code、Trae、Copilot、Cursor 等）可直接理解，只需告知它「按 workflow\.yaml 的 artifacts 顺序执行」即可。

### Q: Spec 格式运行时没有生成 tasks.md

A: 这是预期行为——Spec 导出器不做 tasks 自动补全。如果工作流需要 tasks 产物，请在画布上手动标注一个 taskPlanner 节点或某个 lark 节点的 `specStep` 为 `tasks`。

***

## 参考

- [spec-kit Workflows 文档](https://github.com/github/spec-kit/tree/main/workflows)

- [lark-cli 文档](https://github.com/larksuite/lark-cli)

- [OpenSpec 文档](https://github.com/Fission-AI/OpenSpec)
