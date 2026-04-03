import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,
    // Edge 等浏览器易强缓存 dev 资源，导致仍跑旧脚本（如未走 fetch）；开发态禁止缓存 HTML/模块
    headers: {
      'Cache-Control': 'no-store',
    },
    // H5 开发：页面在 5173、API 在 5000，走代理避免浏览器跨域拦截
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "${path.join(__dirname, 'src/styles/theme.scss').replace(/\\/g, '/')}";\n`,
      },
    },
  },
})
