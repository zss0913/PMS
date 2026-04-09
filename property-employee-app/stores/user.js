import { defineStore } from 'pinia'
import { get, post } from '../utils/request.js'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: uni.getStorageSync('pms_token') || '',
    user: null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(phone, password) {
      const res = await post('/api/mp/login', {
        phone: String(phone || '').trim(),
        password,
        type: 'employee',
      })
      if (!res.success || !res.token || !res.user) {
        throw new Error(res.message || '登录失败')
      }
      this.token = res.token
      this.user = res.user
      uni.setStorageSync('pms_token', res.token)
      return res.user
    },
    logout() {
      this.token = ''
      this.user = null
      uni.removeStorageSync('pms_token')
    },
    async fetchUser() {
      if (!this.token) return null
      try {
        const res = await get('/api/mp/me')
        if (res.success && res.user) {
          this.user = res.user
          return res.user
        }
      } catch (_) {}
      this.logout()
      return null
    },
  },
})
