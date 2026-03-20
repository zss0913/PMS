import { defineStore } from 'pinia'
import { post, get } from '@/api/request'

export interface TenantRelation {
  tenantId: number
  buildingId: number
  isAdmin: boolean
}

export interface MpUser {
  id: number
  name: string
  phone: string
  type: 'tenant' | 'employee'
  companyId: number
  relations?: TenantRelation[]
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
    /**
     * 租客端：同一手机号可在多家物业公司、多个租客下有多条独立账号（与后台 Employee 无关）。
     * 多公司 / 多账号时需按接口提示选择 companyId / tenantUserId。
     */
    async login(phone: string, password: string, companyId?: number, tenantUserId?: number) {
      const stored =
        companyId ??
        (() => {
          const v = uni.getStorageSync('mp_company_id')
          return v !== '' && v != null ? Number(v) : undefined
        })()
      const res = await post<{
        token?: string
        user?: MpUser
        needCompany?: boolean
        companies?: { companyId: number; companyName: string }[]
        needTenantUser?: boolean
        tenantUsers?: {
          id: number
          name: string
          companyId: number
          companyName: string
          tenants: { tenantId: number; companyName: string }[]
        }[]
        message?: string
      }>('/api/mp/login', {
        phone,
        password,
        type: 'tenant',
        ...(stored != null && !Number.isNaN(stored) && stored > 0 ? { companyId: stored } : {}),
        ...(tenantUserId != null && tenantUserId > 0 ? { tenantUserId } : {}),
      })
      if (res.needCompany && res.companies?.length) {
        return {
          needCompany: true as const,
          companies: res.companies,
          message: res.message,
        }
      }
      if (res.needTenantUser && res.tenantUsers?.length) {
        return {
          needTenantUser: true as const,
          tenantUsers: res.tenantUsers,
          message: res.message,
        }
      }
      if (!res.success || !res.token || !res.user) {
        throw new Error(res.message || '登录失败')
      }
      this.token = res.token
      this.user = res.user
      uni.setStorageSync('pms_token', res.token)
      uni.setStorageSync('mp_company_id', res.user.companyId)
      uni.setStorageSync('mp_tenant_user_id', res.user.id)
      return { ok: true as const }
    },
    logout() {
      this.token = ''
      this.user = null
      uni.removeStorageSync('pms_token')
      uni.removeStorageSync('mp_company_id')
      uni.removeStorageSync('mp_tenant_user_id')
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
