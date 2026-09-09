---
name: "picop-install"
description: "Install Picop workflow execution environment (speckit / openspec / lark-cli). Invoke when user runs /picop-install or asks to set up the Picop local run environment."
metadata:
  author: yifei sheng
  version: "1.0"
  generatedBy: "1.0.0"
---

# Picop 环境安装

帮助用户安装 Picop 导出自定义工作流本地执行所需的 CLI 环境。根据用户传入的参数决定安装范围：

| 参数 | 安装内容 |
| --- | --- |
| `--speckit` | speckit + lark-cli |
| `--openspec` | openspec + lark-cli |
| `--all`（默认） | speckit + openspec + lark-cli |

> 未传参数时默认按 `--all` 处理；如用户明确说明只使用某种格式，按对应参数执行。

## 安装前验证

根据用户传入的参数，验证是否已安装对应 CLI 工具。如果安装过则不需要继续安装。直接退出！

```bash
specify --version
openspec --version
lark-cli --version
```

## 1. 安装 speckit（参数为 `--speckit` 或 `--all` 时）

```bash
uv tool install specify-cli
specify --version
```

- 若 `uv` 不存在，先安装 uv：`curl -LsSf https://astral.sh/uv/install.sh | sh`，然后重开 shell 再执行安装。
- 安装后运行 `specify --version` 验证，失败则报错并停止后续相关步骤。
- 如工作流运行时报 `speckit.xxx command not found`，补充执行：

```bash
specify extension add speckit
specify extension list
```

## 2. 安装 openspec（参数为 `--openspec` 或 `--all` 时）

```bash
npm install -g @fission-ai/openspec@latest
openspec --version
```

- 需要已安装 Node.js / npm；版本命令失败则报错并停止后续相关步骤。

## 3. 安装 lark-cli（所有参数模式均安装）

lark-cli 使用内部定制版（lz-feishu-cli），不通过 npm 安装。**克隆到临时目录**，避免污染用户项目：

```bash
git clone https://gitlab.lizhi.fm/ocean/vibe_coding/mcp/application/lz-feishu-cli.git /tmp/lz-feishu-cli
cd /tmp/lz-feishu-cli
chmod +x ./install-lark-cli.sh
./install-lark-cli.sh
```

注意事项：

- 如果 `/tmp/lz-feishu-cli` 已存在，先删除（`rm -rf /tmp/lz-feishu-cli`）再克隆，保证拿到最新版本。
- 安装脚本执行完毕后验证：`lark-cli --version` 或 `lark-cli --help`（以脚本输出为准）。
- 若 git clone 需要认证（内网 GitLab），提示用户配置相应访问权限后重试。
- 安装成功后提示用户运行 `lark-cli auth login` 完成登录，并用 `lark-cli auth status` 确认。

## 4. 安装完成后汇报

- 逐项列出已安装组件及验证结果（版本号）
