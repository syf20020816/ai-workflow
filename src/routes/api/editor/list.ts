import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE = path.resolve(process.cwd())

/**
 * 编辑器文件列表 API
 * 
 * GET /api/editor/list - 列出可编辑的文件
 */
export const Route = createFileRoute('/api/editor/list')({
  server: {
    handlers: {
      GET: async () => {
        const groups: { title: string; files: { name: string; path: string; relativePath: string; language: string }[] }[] = []

        // 1. 规则/提示词文件
        const promptsDir = path.join(WORKSPACE, 'prompts')
        try {
          const promptFiles = await fs.readdir(promptsDir)
          const files = promptFiles
            .filter(f => f.endsWith('.md'))
            .map(f => ({
              name: f,
              path: path.join(promptsDir, f),
              relativePath: path.join('prompts', f),
              language: 'markdown',
            }))
          if (files.length > 0) {
            groups.push({ title: '提示词 (Prompts)', files })
          }
        } catch { /* 目录不存在 */ }

        // 2. 记忆文件
        const memoryDir = path.join(WORKSPACE, 'memory')
        try {
          const memoryFiles = await fs.readdir(memoryDir)
          const files = memoryFiles
            .filter(f => f.endsWith('.md'))
            .map(f => ({
              name: f,
              path: path.join(memoryDir, f),
              relativePath: path.join('memory', f),
              language: 'markdown',
            }))
          if (files.length > 0) {
            groups.push({ title: '记忆 (Memory)', files })
          }
        } catch { /* 目录不存在 */ }

        // 3. 工作流 JSON 文件
        const workflowsDir = path.join(WORKSPACE, 'workflows')
        try {
          const wfFiles = await fs.readdir(workflowsDir)
          const files = wfFiles
            .filter(f => f.endsWith('.json'))
            .map(f => ({
              name: f,
              path: path.join(workflowsDir, f),
              relativePath: path.join('workflows', f),
              language: 'json',
            }))
          if (files.length > 0) {
            groups.push({ title: '工作流 (Workflows)', files })
          }
        } catch { /* 目录不存在 */ }

        // 4. 配置文件
        const configFiles = [
          { name: 'skill.conf.json', relativePath: 'skill.conf.json', language: 'json' as const },
        ]

        const resolvedConfigs: { name: string; path: string; relativePath: string; language: string }[] = []
        for (const cf of configFiles) {
          const fullPath = path.join(WORKSPACE, cf.relativePath)
          try {
            await fs.access(fullPath)
            resolvedConfigs.push({ ...cf, path: fullPath })
          } catch { /* 文件不存在 */ }
        }
        if (resolvedConfigs.length > 0) {
          groups.push({ title: '配置文件', files: resolvedConfigs })
        }

        return Response.json({ status: 'success', data: groups })
      },
    },
  },
})
