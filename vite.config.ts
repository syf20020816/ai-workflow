import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    watch: {
      // 规避 TanStack Router generator 与 Vite watcher 在 macOS/APFS 上的 mtime 竞争导致无限 reload
      // 参考：https://github.com/TanStack/router/issues/6775
      ignored: ['**/routeTree.gen.ts'],
    },
  },
  plugins: [devtools(), tanstackStart(), viteReact()],
})

export default config
