---
name: "viki"
description: "OpenViki skill for MCP"
metadata:
  author: yifei sheng
  version: "1.0"
  generatedBy: "1.0.0"
---

# Skill: OpenViking 代码检索与文件操作 MCP 使用规范

## 目标

本Skill规定模型使用 openviking MCP 工具访问项目源码的策略，处理代码读取、目录浏览、代码搜索、文件编辑。

## 参数

### 可用参数

- find: Fast semantic retrieval without session context.
  Returns ranked memories, resources, and skills with URI, abstract, score.

- search: Deep semantic retrieval with optional session context & intent analysis.
  mode="list": ranked list with URI, abstract, score
  mode="context": token-budgeted injection-ready context block
  Params: target_uri, category quotas, purpose presets, detail tiers, cross-turn deduplication, peer scoping, rewriting.

- read: Read one or more viking:// file URIs.
  Raster images & supported audio return native MCP content blocks.
  Use list() for directory listing.

- list: List one sorted page under a viking:// directory URI.
  Args:
  uri Directory URI to list.
  recursive Whether to recursively list descendants.
  offset Number of entries to skip for pagination.
  limit Optional max entry limit.
  sort_by Optional: name | modification-time
  sort_order Optional: ascending | descending

- tree: Show one visible page from recursive directory tree.
  Args:
  uri Directory URI to traverse.
  level_limit Max traversal depth.
  node_limit Default result limit.
  include_abstract Whether to include file summaries.
  offset Nodes to skip for pagination.
  limit Override node_limit.

- remember: Store information into OpenViking long-term memory.
  Use for user preferences, key facts, decisions to persist.

- write: Write text to viking:// file.
  Supports .md .txt .json .yaml .yml .toml .py .js .ts only.
  Writable scopes: viking://resources/, viking://user/{user_id}/, viking://agent/.
  viking://~ alias expands to user root. skills/, peers/, privacy/, sessions/ are read-only.
  Args:
  mode replace (default) | create | append
  wait boolean, block until search index refreshed after write.

- edit: Targeted in-place file modification.
  Replace exact string match in existing file. Prefer over full write for partial edits.
  Args:
  old_string Exact match (including whitespace/newlines).
  new_string Replacement content. Empty string "" deletes old_string.
  replace_all bool, replace all matches if true; else fail on multiple matches.
  Notes: read() first to fetch current content. Fails if old_string not found.

- add_resource: Add external resource to OpenViking (async background ingestion).
  Supported source: http/https URL, git repo, local file, sitemap/RSS.
  Args:
  path Remote URL or local file path (required unless temp_file_id set).
  temp_file_id Server upload id from prior signed upload.
  add_type Connector type (tos, git, etc).
  to Exact final target URI (required when add_type set).
  parent Directory to store resource (mutually exclusive with to).
  description Human description of this resource.
  watch_interval Auto refresh interval in minutes; 0 = no watch.
  processing_mode semantic_and_vectors | vectors_only
  tags k=v tags applied after ingestion.
  tag_mode replace | append (default replace).
  args Parser-specific options (auth, site ingest flags, etc.)

- list_watches: List all visible auto-refresh watch subscription tasks.

- cancel_watch: Cancel a watch task by target viking:// URI. Irreversible.

- grep: Regex text search inside viking:// files.
  Multiple patterns can run concurrently.
  Use search() for semantic retrieval; grep for exact pattern match.

- glob: Find files by glob pattern (e.g. \*_/_.md, \*.ts).
  Match filenames, not content. Use search for content retrieval.

- forget: Permanently delete a viking:// URI from OpenViking.
  WARNING: irreversible. Confirm before invocation.

- health: Check OpenViking server health status.

## 注意点

1. This is an MCP toolset, not a standalone binary CLI.
2. Tools are called by model automatically, no manual /slash command required.
3. All file references use viking:// URI namespace.
4. 使用中文回答问题，避免使用英文。