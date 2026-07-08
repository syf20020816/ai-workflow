---
name: lz-feishu-doc-skill
version: 1.0.5
description: "当用户粘贴飞书/Lark 文档或知识库链接、或要求阅读/总结/理解飞书云文档时，优先通过 lark-cli 与各 lark-* Skill 拉取可解析的全量内容（正文、块结构、附件与嵌入对象），禁止先用 WebFetch/通用网页抓取走弯路；仅当 lark-cli 无法覆盖时再查 MCP 或其它工具。指导 Agent 通读文档内文字、图片、电子表格、多维表格、代码块、画板/UML 与时序等图、思维导图、OKR/任务/名片等可解析块；文档内嵌电子表格（sheet 块）出现 token 时必须自动用 lark-sheets 拉取表数据并纳入答复，不得反问用户是否要读表。文中超链指向的其它独立文档/Wiki/多维表格可在主文档读完后询问是否继续递归阅读，避免断章取义。"
metadata:
  requires:
    bins: ["lark-cli"]
---

# 飞书文档阅读优先策略（lz-feishu-doc-skill）

## 何时启用

- 用户消息中出现飞书/Lark 链接（`feishu.cn`、`larksuite.com`、`feishu.net` 等）且指向**文档、知识库节点、云空间文件、电子表格、多维表格**等。
- 用户口头要求：**阅读、通读、总结、理解、提取要点、基于某飞书文档作答**，或「把文档内容 …」。

## 路径优先级（必须遵守）

1. **优先 lark-cli + 官方 lark-* Skills**（按内容类型组合使用，见下文）。不要用 WebFetch、浏览器自动化或第三方爬虫去「打开网页」代替 API/CLI。
2. **仅当**已确认当前需求在 lark-cli 无对应命令/Shortcut、或权限与接口确实无法覆盖时，再考虑 **MCP**（如 openapi 探索、其它已接入能力）或用户明确指定的其它方式。
3. 任何回退到非 lark 方案前，在回复中**简要说明**为何 lark-cli 不足以完成（例如缺 scope、对象类型未封装、需企业专属接口等）。

开始前务必加载并遵循 **lark-shared** Skill（认证、`--as user`、权限与 scope）。

## 链接与对象路由

- **`/docx/`、`/doc/`**：云文档 → **lark-doc**（`docs +fetch`、`+media-download`、`+search` 等）；旧版/新版差异按 lark-doc 说明处理。
- **`/wiki/`**：知识库节点 → 先用 **`lark-cli wiki spaces get_node`** 解析真实 `obj_type` / `obj_token`（见下文 **「知识库节点：wiki spaces get_node」**），再按类型切到 doc / sheets / bitable / drive 等 Skill，**禁止**把 wiki URL 里的节点 token 直接当云文档 `file_token` 滥用。
- **`/sheets/`**：电子表格 → **lark-sheets**（读取单元格、工作表、导出等）。
- **文档内嵌电子表格（`docs +fetch` 等导出中的 `<sheet token="..."/>` 或可解析的 sheet 块）** → **同一轮任务内立即**用 **lark-sheets** 按 token 读取（多工作表则覆盖用户问题相关 sheet 或拉全），将单元格内容并入答案。**禁止**在仅描述「这里嵌了一张表」后停下来反问用户要不要读表；权限或接口失败时再说明原因与缺口。
- **文中嵌入或指向的多维表格（bitable）** → **lark-base**（表/字段/记录/视图等）；若 `+fetch` 已给出可操作的 bitable token，同样**应自动拉取**可读数据，而非仅提示用户自行打开。
- **画板、文档内嵌图表/UML（时序图、流程图、类图、架构图及自定义图）** → **lark-whiteboard** 与 **lark-doc** 中画板、`+media-download` 等说明；能拉 DSL 或缩略图/导出则尽量拉全，不要只读周边文字描述。
- **思维导图（mindnote 等）**：按 **lark-doc** 中 `obj_type` 与 drive/文档块类型处理，能取结构化内容或导出则取全量。
- **OKR、任务、任务列表**：在文档块或独立对象中出现时，用 **lark-task** 及 lark-cli 已注册接口可读部分；与文档正文一并汇总，避免只读正文忽略块内任务。
- **名片 / 联系人类块**：**lark-contact** 辅助解析人员与 open_id 等信息（在权限与接口允许范围内）。

云空间文件、附件、评论等：**lark-drive** 与 **lark-doc** 的 `+media-download` 等配合使用。

## 知识库节点：wiki spaces get_node（当前 lark-cli 写法）

当前 CLI **没有** `wiki +get-node`，也**没有**在该子命令上使用 `--doc`。获取知识空间节点信息必须用嵌套子命令 **`wiki spaces get_node`**，查询参数通过 **`--params` JSON** 传入。

**不确定字段时**：先执行 `lark-cli schema wiki.spaces.get_node`，再组 `--params`。

### 从 URL 取 `token`

- 形如 `https://xxx.feishu.cn/wiki/<NODE_TOKEN>`（或 Lark 等价域名）：路径中 **`wiki/` 后第一段**即为知识库**节点 token**，此时一般传 `"obj_type":"wiki"`（与 OpenAPI 默认一致；也可显式写出）。
- 若链接路径是 `docx/`、`sheets/`、`base/` 等，则说明已是**云文档实际 token**，应用 `get_node` 时 **`obj_type` 须与真实类型一致**（如 `docx`、`sheet`、`bitable`），详见 schema 中 `token` / `obj_type` 说明。

### 命令示例

```bash
# 知识库 wiki 链接：https://.../wiki/IKqdwQkPripNKbkAoqZcOUs8nMf
lark-cli wiki spaces get_node --params '{"token":"IKqdwQkPripNKbkAoqZcOUs8nMf","obj_type":"wiki"}'
```

从返回的 `node` 中读取真实 `obj_type`、`obj_token`（或等价字段，以 JSON 为准），再调用 `docs +fetch`、`lark-sheets`、**lark-base** 等继续拉正文或表数据。

## 「充分阅读」执行标准

1. **主文档**：对主链接对应对象，用 lark-cli 拉取**在权限内可获得的完整层级**（例如 docx 块树/ Markdown 导出、表格全表或多 sheet、bitable 多表多视图），不要只摘第一段或搜索结果片段。
2. **富媒体与复杂块**：图片、文件、画板、代码块、嵌入表格/多维表格、OKR/任务/名片等 —— 凡 CLI 能解析或下载的，都应覆盖；不能解析的块类型需在回复中**明确列出缺口**（例如「某块类型平台未返回结构化数据」），而不是假装已读。其中 **内嵌 sheet / 内嵌 bitable** 一旦出现可用 token，**默认必须**在本轮用对应 Skill 拉取结构化内容，与用户是否明说「读表」无关。
3. **文中与文末超链（非内嵌块）**：在完成主文档及**已识别的内嵌对象**拉取后，对文档正文里**点击跳转**的其它飞书文档链接、Wiki 节点、独立多维表格/表格 URL 等，可**主动询问**用户是否继续递归阅读；若用户同意，按相同优先级拉取。注意与第 2 条区分：**内嵌块不等同于超链**，内嵌块不询问、直接读。
4. **输出习惯**：总结或转述时应体现**结构对应关系**（标题层级、表格维度、任务与 OKR 条目等），避免把表格压成一句话、把图表仅描述为「有一张图」。

## 团队固定 OAuth Scope 清单（权威副本）

与仓库根目录 **`install-lark-cli.sh`** 中变量 **`SCOPES="..."` 内字符串字符级相同**，供用户本机**已删除或移动安装脚本**时仍可按团队约定重新授权。维护者增删权限时须与本脚本、本段、`.cursor/rules/feishu-lark-scopes-sync.mdc` **三处同步**（见该 Cursor 规则）。

重新登录时整段作为**一条** `--scope` 参数值（空格分隔多个 scope，勿拆成多次 `--scope` 除非 CLI 文档明确要求）：

```text
auth:user.id:read base:app:copy base:app:create base:app:read base:app:update base:dashboard:create base:dashboard:delete base:dashboard:read base:dashboard:update base:field:create base:field:delete base:field:read base:field:update base:form:create base:form:delete base:form:read base:form:update base:record:create base:record:delete base:record:read base:record:update base:role:create base:role:delete base:role:read base:role:update base:table:create base:table:delete base:table:read base:table:update base:view:read base:view:write_only base:workflow:create base:workflow:read base:workflow:update bitable:app:readonly board:whiteboard:node:create board:whiteboard:node:delete board:whiteboard:node:read calendar:calendar.free_busy:read calendar:calendar:create calendar:calendar:delete calendar:calendar:read calendar:calendar:update docs:document.comment:create docs:document.comment:delete docs:document.comment:read docs:document.comment:update docs:document.comment:write_only docs:document.media:download docs:document.media:upload docs:document:copy docs:event:subscribe docs:permission.member:auth docs:permission.member:create docs:permission.member:transfer docx:document docx:document.block:convert docx:document:create docx:document:readonly docx:document:write_only drive:drive.metadata:readonly drive:drive:readonly drive:file:download drive:file:upload im:chat:read search:docs:read sheets:spreadsheet:read sheets:spreadsheet:readonly wiki:node:create wiki:node:read wiki:wiki:readonly
```

用法：将上一代码框中的**整行**复制到引号内执行 `lark-cli auth login --scope "..."`（勿省略中间任一 scope）。

## 访问令牌过期与重新授权

- **会过期**：`lark-cli` 使用的用户 OAuth 访问令牌**并非永久有效**；长时间未使用、超过飞书侧有效期或刷新失败后，CLI 调用会失败。具体时长以飞书开放平台策略为准，勿假设「装过一次就永远可用」。
- **常见表现**：`lark-cli` 报未登录/令牌无效、`401`、`invalid_token`、接口返回与认证相关的错误；或此前可用的命令突然全部失败。若错误信息指向**缺 scope**，可能是应用侧未开通或从未授权该权限，与「过期」不同，需对照 **lark-shared** 与开放平台配置区分。
- **Agent 应先自检**：执行 `lark-cli auth status`（必要时 `lark-cli auth check` 配合报错中的 scope）确认当前登录态与已授权范围。
- **过期或未登录时的处理**（由 Agent 在终端代用户发起，并说明需在浏览器中完成确认）：
  1. **`--scope` 必须与团队清单完全一致（硬性要求）**：重新执行 `lark-cli auth login` 时，**只能**使用与 **`install-lark-cli.sh` 中 `SCOPES="..."` 字符级相同**的整段字符串。优先用 **Read** 读取用户工作区或仓库根目录的 `install-lark-cli.sh` 并解析 `SCOPES=` 行；**若该文件不存在、路径未知或无法读取**，则使用本 Skill 上文 **「团队固定 OAuth Scope 清单」**代码框内的**单行全文**（须与脚本保持同步；若你发现与脚本不一致，以仓库内 `install-lark-cli.sh` 为准并提醒用户联系维护者更新 Skill/规则）。**禁止**改用 `--recommend`、`--domain` 兜底、或自行挑选子集 scope。
  2. 按 **lark-shared** 执行：`lark-cli auth login --scope "<完整字符串>"`；若使用 device flow，**发起 `--no-wait --json` 的那条命令也必须携带同一 `--scope`**，再按输出用 `lark-cli auth login --device-code "..."` 轮询至完成。
  3. 若用户仍持有 **lz-feishu-cli** 安装目录，可提示**重跑** `./install-lark-cli.sh` 完成授权（`SCOPES` 与团队一致）。
  4. **禁止**在仅因令牌过期或未登录失败时，改走 WebFetch/MCP「绕过」读文档；应先恢复有效登录，再继续 lark-cli 路径。
- **完成后**：再次执行原失败命令或 `lark-cli auth status` 确认已恢复。

## 仍搞不定时

- 使用 **lark-openapi-explorer** 查原生 OpenAPI，再通过 `lark-cli api` 调用。
- 再不足则使用用户环境已配置的 **MCP** 或其它工具，并说明切换原因。

## lark-cli 常见参数错误（必读）

**严禁凭记忆猜测 flag 名称**，必须使用 lark-cli 实际支持的参数。以下是高频易错项：

| 错误写法 | 正确写法 | 说明 |
|---------|---------|------|
| `--docx <token>` | `--doc <token>` | `docs +fetch` 的文档参数是 `--doc`，不是 `--docx` |
| `wiki +get-node --doc <url>` | `wiki spaces get_node --params '{"token":"...","obj_type":"wiki"}'` | `wiki` 下无 `+get-node`；节点查询用 `spaces get_node` + `--params`，**不是** `--doc` |

**执行纪律：**
1. 如果不确定某个子命令支持哪些 flag，**先运行对应 `--help`**（例如 `docs +fetch --help`、`lark-cli wiki spaces get_node --help`）；嵌套命令用 `lark-cli wiki spaces --help` 逐级查看。
2. **不要自行拼凑或缩写 flag 名**（如把 `--doc` 写成 `--docx`、`--document`、`--token` 等）。
3. **`docs +fetch` 等文档类命令**：文档 token 或 URL 通过 `--doc` 传入，lark-cli 会自动识别。**`wiki spaces get_node` 等 OpenAPI 风格命令**：用 `--params` JSON，勿套用 `--doc`。

## 媒体下载落盘与自动清理（必须遵守）

`lark-cli docs +media-download` 会把图片/附件写入本地文件。如果不显式指定 `--output`，很容易把文件落到当前工作目录并残留，污染用户项目目录。

**执行规范：**

1. **必须写入临时目录**：所有 `docs +media-download` 调用都要带 `--output`，保存到 `mktemp -d` 创建的临时目录中。
2. **本轮输出完成后必须清理**：图片/附件内容已被解析并纳入回复后，立刻 `rm -rf "$tmpdir"`。
3. **异常/中断兜底清理**：用 `trap` 在进程退出时清理临时目录，尽量覆盖中断、报错退出等情况。
4. **用户明确要求保留时**：才把文件复制到用户指定目录（例如 `./assets/`），并在回复中说明保存路径。

推荐模板（可直接在终端执行，按实际 token 与输出文件名调整）：

```bash
tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT INT TERM

# 例：下载 media（图片/附件）
lark-cli docs +media-download --type media --token "<resource_token>" --output "$tmpdir/media.bin"

# 读取/解析完成后（或在答案中引用完毕后）会自动清理；如需立即清理也可手动 cleanup
```

## 与安全相关的提醒

- 阅读类操作默认**只读**；若用户要求改文档/改表，需在执行写入前确认意图，并遵守各 lark-* Skill 中的安全约定（含 `--dry-run` 等）。
