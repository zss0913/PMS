import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const themeScssUrl = pathToFileURL(path.join(__dirname, 'src/styles/theme.scss')).href

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,
    // Edge 等浏览器易强缓存 dev 资源，导致仍跑旧脚本（如未走 fetch）；开发态禁止缓存 HTML/模块
    headers: {
      'Cache-Control': 'no-store',
    },
    // H5 开发：页面在 5173、API 在 5001，走代理避免浏览器跨域拦截
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "${themeScssUrl}" as *;\n`,
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
})
