import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // @use 替代已弃用的 @import；as * 使变量/mixin 与原先全局注入行为一致
        additionalData: `@use "${path.join(__dirname, 'src/styles/theme.scss').replace(/\\/g, '/')}" as *;\n`,
        // Dart Sass：抑制旧版 JS API 等弃用告警（开发/构建日志更干净）
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
})
