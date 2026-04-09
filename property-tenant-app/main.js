import App from './App.vue'
import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import uviewPlus from 'uview-plus'
import 'uview-plus/index.scss'
import './stores/user.js'

export function createApp() {
  const app = createSSRApp(App)
  
  // Use Pinia
  const store = Pinia.createPinia()
  app.use(store)
  
  // Use uview-plus
  app.use(uviewPlus)
  
  return {
    app,
    Pinia
  }
}
