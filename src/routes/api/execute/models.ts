import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'

const CONFIG_PATH = path.resolve(process.cwd(), 'model.conf.json')

function readModels(): any[] {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8')
      return JSON.parse(data) || []
    }
  } catch {
    return []
  }
  return []
}

export const Route = createFileRoute('/api/execute/models')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const models = readModels().map((m: any) => ({
            id: m.id,
            name: m.name,
            modelName: m.modelName,
            kind: m.kind,
            description: m.description || '',
          }))
          return Response.json({ status: 'success', output: { models } })
        } catch (err: any) {
          return Response.json({ status: 'error', output: {}, error: err.message })
        }
      },
    },
  },
})
