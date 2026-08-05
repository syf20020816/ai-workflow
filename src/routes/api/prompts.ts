import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'

const PROMPTS_DIR = path.resolve(process.cwd(), 'prompts')

/**
 * 提示词管理 API
 * 
 * GET  /api/prompts           - 列出所有提示词文件及元信息
 * GET  /api/prompts?name=xxx  - 获取指定提示词文件内容
 * POST /api/prompts           - 保存提示词文件内容
 */

/** 每个提示词文件对应的使用位置 */
const PROMPT_USAGE: Record<string, { name: string; usedBy: { label: string; path: string }[] }> = {
  'codeAgent.md': {
    name: 'CodeAgent 系统提示词',
    usedBy: [
      { label: '代码处理节点 (CodeAgent)', path: 'src/routes/api/execute/codeAgent.ts' },
    ],
  },
  'keywordAgent.md': {
    name: '关键词提取节点系统提示词',
    usedBy: [
      { label: '关键词提取节点 (KeywordAgent)', path: 'src/components/panel/edit/keywordAgent.tsx' },
    ],
  },
  'taskPlanner.md': {
    name: '任务拆解节点系统提示词',
    usedBy: [
      { label: '任务拆解节点 (TaskPlanner)', path: 'src/components/panel/edit/taskPlanner.tsx' },
    ],
  },
}

export const Route = createFileRoute('/api/prompts')({
  server: {
    handlers: {
      GET: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const name = url.searchParams.get('name')

        try {
          await fs.mkdir(PROMPTS_DIR, { recursive: true })
        } catch { /* ignore */ }

        if (name) {
          const filePath = path.join(PROMPTS_DIR, name)
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            const usage = PROMPT_USAGE[name]
            return Response.json({
              status: 'success',
              data: {
                name,
                content,
                usage: usage?.usedBy || [],
              },
            })
          } catch {
            return Response.json({ status: 'error', error: `提示词文件 ${name} 不存在` })
          }
        }

        // 列出所有提示词文件
        const files = await fs.readdir(PROMPTS_DIR)
        const mdFiles = files.filter(f => f.endsWith('.md'))
        const items = mdFiles.map(f => ({
          name: f,
          displayName: PROMPT_USAGE[f]?.name || f.replace('.md', ''),
          usage: PROMPT_USAGE[f]?.usedBy || [],
        }))

        return Response.json({ status: 'success', data: items })
      },

      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { name, content } = body

        if (!name || content === undefined) {
          return Response.json({ status: 'error', error: '缺少 name 或 content' })
        }

        const filePath = path.join(PROMPTS_DIR, name)
        await fs.writeFile(filePath, content, 'utf-8')

        return Response.json({ status: 'success', message: '已保存' })
      },
    },
  },
})
