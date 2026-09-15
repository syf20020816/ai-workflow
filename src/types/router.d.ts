import type { AnyRoute, AnyContext } from '@tanstack/router-core'

/**
 * TanStack Start 类型增广
 *
 * createFileRoute 的 options 支持 server 选项（服务端 API 处理函数），
 * 但当前安装的 @tanstack/react-start 类型包未注入对应类型。
 * 所有 /api/* 路由的 `server: { handlers }` 约定依赖此增广。
 */
declare module '@tanstack/router-core' {
  interface FilebaseRouteOptionsInterface<
    TRegister,
    TParentRoute extends AnyRoute = AnyRoute,
    TId extends string = string,
    TPath extends string = string,
    TSearchValidator = undefined,
    TParams = {},
    TLoaderDeps extends Record<string, any> = {},
    TLoaderFn = undefined,
    TRouterContext = {},
    TRouteContextFn = AnyContext,
    TBeforeLoadFn = AnyContext,
    TRemountDepsFn = AnyContext,
    TSSR = unknown,
    TServerMiddlewares = unknown,
    THandlers = undefined,
  > {
    /** 服务端 API 处理函数：HTTP 方法 → 处理器（ctx.request 为原始请求） */
    server?: {
      handlers?: Record<string, (ctx: { request: Request }) => Promise<Response>>
    }
  }
}

export {}
