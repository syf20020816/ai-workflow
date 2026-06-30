import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import path from 'node:path'
import type { Model } from '#/types/model'

const DATA_PATH = path.resolve(process.cwd(), 'model.conf.json')

function readModels(): Model[] {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
}

function writeModels(models: Model[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(models, null, 2))
}

export const Route = createFileRoute('/api/model')({
  server: {
    handlers: {
      GET: async () => {
        const models = readModels()
        return Response.json(models)
      },
      POST: async (ctx: any) => {
        const body: Model = await ctx.request.json()
        const models = readModels()
        body.id = body.id || crypto.randomUUID()
        models.push(body)
        writeModels(models)
        return Response.json(body, { status: 201 })
      },
      PUT: async (ctx: any) => {
        const body: Model = await ctx.request.json()
        const models = readModels()
        const idx = models.findIndex((m) => m.id === body.id)
        if (idx === -1) {
          return Response.json({ error: 'Model not found' }, { status: 404 })
        }
        models[idx] = body
        writeModels(models)
        return Response.json(models[idx])
      },
      DELETE: async (ctx: any) => {
        const url = new URL(ctx.request.url)
        const id = url.searchParams.get('id')
        if (!id) {
          return Response.json({ error: 'Missing id' }, { status: 400 })
        }
        const models = readModels()
        writeModels(models.filter((m) => m.id !== id))
        return Response.json({ success: true })
      },
    },
  },
})
