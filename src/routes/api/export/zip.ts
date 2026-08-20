import { createFileRoute } from '@tanstack/react-router'
import type { Node, Edge } from '@xyflow/react'
import { buildWorkflow } from '#/services/exporter'
import type { ExportTarget, ExportOptions } from '#/services/exporter'

/**
 * zip 全量导出 API
 * 动态引入 jszip 与 artifactCollector（含 Node 内置模块），避免 SSR 预加载异常。
 */
export const Route = createFileRoute('/api/export/zip')({
  server: {
    handlers: {
      POST: async (ctx: any) => {
        const body = await ctx.request.json()
        const { nodes, edges, target, name, options } = body as {
          nodes: Node[]
          edges: Edge[]
          target: ExportTarget
          name?: string
          options?: ExportOptions
        }

        const logs: string[] = []
        logs.push(`导出 zip: target=${target}, name=${name || '未命名'}`)

        try {
          const exportOptions: ExportOptions = {
            name,
            mergeParallel: options?.mergeParallel ?? false,
            knowledgeStrategy: options?.knowledgeStrategy ?? 'snapshot',
            snapshotThreshold: options?.snapshotThreshold ?? 2 * 1024 * 1024,
          }

          const { yaml, workflowPath, artifacts: plannedArtifacts } = buildWorkflow(
            target,
            nodes,
            edges,
            exportOptions,
          )

          const [{ default: JSZip }, { collectArtifacts }] = await Promise.all([
            import('jszip'),
            import('#/services/artifactCollector'),
          ])

          const zip = new JSZip()

          // 1. 写入主工作流文件
          zip.file(workflowPath, yaml)
          logs.push(`已生成 ${workflowPath}`)

          // 2. 收集占位文件（spec 阶段模板等）
          for (const artifact of plannedArtifacts) {
            if (!zip.file(artifact.path)) {
              zip.file(artifact.path, artifact.content)
            }
          }

          // 3. 收集真实输入物内容（Skill / Memory / Lark / Qdrant 快照）
          const collected = await collectArtifacts(nodes, {
            knowledgeStrategy: exportOptions.knowledgeStrategy,
            snapshotThreshold: exportOptions.snapshotThreshold,
          })

          for (const item of collected) {
            // 真实内容覆盖占位内容
            zip.file(item.path, item.content)
            if (item.warning) logs.push(`警告: ${item.warning}`)
          }

          // 4. 写入 manifest
          const manifest = {
            name: name || 'picop-workflow',
            target,
            workflowPath,
            artifactCount: plannedArtifacts.length + collected.length,
            collectedSources: collected.map((c) => c.source),
            logs,
          }
          zip.file('manifest.json', JSON.stringify(manifest, null, 2))

          const content = await zip.generateAsync({ type: 'uint8array' })
          const safeName = (name || 'picop-workflow').replace(/[^a-zA-Z0-9_-]+/g, '-')

          return new Response(content.buffer as ArrayBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${safeName}.zip"`,
            },
          })
        } catch (err: any) {
          return Response.json(
            {
              status: 'error',
              error: err.message,
              logs,
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
