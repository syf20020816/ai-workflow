import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs/promises'
import path from 'node:path'

export const Route = createFileRoute('/api/execute/code')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { mode = 'local', filePath, branch = 'master', lines = [], input = {} } = body

        const logs: string[] = []

        if (!filePath) {
          return Response.json({
            status: 'success',
            output: {
              ...input,
              _codeError: '未配置文件路径',
              _fromCodeNode: true,
            },
            logs: ['代码节点: 未配置文件路径，跳过代码分析'],
          })
        }

        logs.push(`代码节点: ${mode === 'local' ? '本地' : '云端'}模式`)
        logs.push(`文件: ${filePath} (分支: ${branch})`)

        const upstreamResponse = (input as any).response || (input as any).analysis || ''

        if (mode === 'local') {
          try {
            const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
            const normalizedPath = path.normalize(resolvedPath)

            if (filePath.includes('..')) {
              logs.push(`路径安全校验失败: 检测到路径穿越尝试 (${filePath})`)
              return Response.json({
                status: 'success',
                output: {
                  ...input,
                  _codeMode: mode,
                  _codeFile: filePath,
                  _codeBranch: branch,
                  _codeError: '路径安全校验失败: 检测到路径穿越尝试',
                  _fromCodeNode: true,
                  _codeStatus: 'error',
                },
                logs,
              })
            }

            logs.push(`正在读取本地文件: ${normalizedPath}`)

            const fileContent = await fs.readFile(resolvedPath, 'utf-8')
            const allLines = fileContent.split('\n')
            const totalLines = allLines.length

            logs.push(`文件总行数: ${totalLines}`)

            let extractedContent: string
            let readLineInfo: string

            if (lines.length > 0) {
              const sortedLines = [...lines].sort((a, b) => a.start - b.start)
              const parts: string[] = []
              for (const range of sortedLines) {
                const startIdx = Math.max(0, range.start - 1)
                const endIdx = Math.min(totalLines, range.end)
                if (startIdx < endIdx) {
                  const snippet = allLines.slice(startIdx, endIdx)
                  parts.push(`// Lines ${range.start}-${range.end}:\n${snippet.join('\n')}`)
                }
              }
              extractedContent = parts.join('\n\n')
              readLineInfo = `行 ${sortedLines.map((l) => `${l.start}-${l.end}`).join(', ')}`
            } else {
              extractedContent = fileContent
              readLineInfo = '全部'
            }

            logs.push(`完成代码读取 (${readLineInfo})`)

            return Response.json({
              status: 'success',
              output: {
                ...input,
                _codeMode: mode,
                _codeFile: normalizedPath,
                _codeBranch: branch,
                _codeTotalLines: totalLines,
                _codeLines: readLineInfo,
                _codeContent: extractedContent,
                _codeRequest: upstreamResponse,
                _fromCodeNode: true,
                _codeStatus: 'success',
              },
              logs,
            })
          } catch (err: any) {
            logs.push(`读取文件失败: ${err.message}`)

            return Response.json({
              status: 'success',
              output: {
                ...input,
                _codeMode: mode,
                _codeFile: filePath,
                _codeBranch: branch,
                _codeError: `读取失败: ${err.message}`,
                _fromCodeNode: true,
                _codeStatus: 'error',
              },
              logs,
            })
          }
        }

        logs.push(`云端模式暂未实现，需要集成 CI/CD 或 Git API`)

        return Response.json({
          status: 'success',
          output: {
            ...input,
            _codeMode: mode,
            _codeFile: filePath,
            _codeBranch: branch,
            _codeRequest: upstreamResponse,
            _fromCodeNode: true,
            _codeStatus: 'pending',
          },
          logs,
        })
      },
    },
  },
})
