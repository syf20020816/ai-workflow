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

        // 4. 技能文件（workflows/skills 下的 skill.md）
        const skillsDir = path.join(WORKSPACE, 'workflows/skills')
        try {
          const skillEntries = await fs.readdir(skillsDir, { withFileTypes: true })
          const files: { name: string; path: string; relativePath: string; language: string }[] = []
          for (const entry of skillEntries) {
            if (entry.isDirectory()) {
              const skillMdPath = path.join(skillsDir, entry.name, 'skill.md')
              try {
                await fs.access(skillMdPath)
                files.push({
                  name: `${entry.name}/skill.md`,
                  path: skillMdPath,
                  relativePath: path.join('workflows/skills', entry.name, 'skill.md'),
                  language: 'markdown',
                })
              } catch { /* 该技能没有 skill.md */ }
            }
          }
          if (files.length > 0) {
            groups.push({ title: '技能 (Skills)', files })
          }
        } catch { /* 目录不存在 */ }

        return Response.json({ status: 'success', data: groups })
      },
    },
  },
})
