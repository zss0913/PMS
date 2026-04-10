import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** file:// + 百分号编码，避免 Windows 下含中文绝对路径在 Dart Sass 中无法解析 */
const themeScssUrl = pathToFileURL(path.join(__dirname, 'src/styles/theme.scss')).href

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
        additionalData: `@use "${themeScssUrl}" as *;\n`,
        silenceDeprecations: ['legacy-js-api', 'import'],
      },
    },
  },
})
