import App from './App.vue'
import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import uviewPlus from 'uview-plus'
import 'uview-plus/index.scss'

export function createApp() {
  const app = createSSRApp(App)

  const store = Pinia.createPinia()
  app.use(store)

  app.use(uviewPlus)

  return {
    app,
    Pinia,
  }
}
