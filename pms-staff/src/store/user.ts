import { defineStore } from 'pinia'
import { post, get } from '@/api/request'

export interface MpUser {
  id: number
  name: string
  phone: string
  type: 'tenant' | 'employee'
  companyId: number
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: uni.getStorageSync('pms_token') || '',
    user: null as MpUser | null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(phone: string, password: string) {
      const res = await post<{ token: string; user: MpUser }>('/api/mp/login', {
        phone,
        password,
        type: 'employee',
      })
      if (!res.success || !res.token || !res.user) {
        throw new Error(res.message || '登录失败')
      }
      this.token = res.token
      this.user = res.user
      uni.setStorageSync('pms_token', res.token)
    },
    logout() {
      this.token = ''
      this.user = null
      uni.removeStorageSync('pms_token')
    },
    setUser(user: MpUser | null) {
      this.user = user
    },
    async fetchUser() {
      if (!this.token) return
      try {
        const res = await get('/api/mp/me')
        if (res.success && res.user) {
          this.user = res.user as MpUser
        }
      } catch {
        this.logout()
      }
    },
  },
})
