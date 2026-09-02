import { defineConfig } from 'dumi'

export default defineConfig({
  title: 'Picop 文档',
  favicons: [],
  themeConfig: {
    name: 'Picop',
    logo: false,
    footer: false,
    prefersColor: { default: 'auto', switch: true },
  },
  locales: [
    { id: 'zh-CN', name: '中文' },
  ],
})