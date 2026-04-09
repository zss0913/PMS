import { defineStore } from 'pinia'
import { post, get } from '../utils/request.js'

const PREF_PHONE = 'mp_pref_phone'
const PREF_TENANT_USER_ID = 'mp_pref_tenant_user_id'
const PREF_COMPANY_ID = 'mp_pref_company_id'
const PREF_ACTIVE_TENANT_ID = 'mp_pref_active_tenant_id'

function readPrefCompanyId(phone) {
  const prefPhone = uni.getStorageSync(PREF_PHONE)
  const raw = uni.getStorageSync(PREF_COMPANY_ID)
  if (prefPhone !== phone || raw === '' || raw == null) return undefined
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0 ? n : undefined
}

function readPrefTenantUserId(phone) {
  const prefPhone = uni.getStorageSync(PREF_PHONE)
  const raw = uni.getStorageSync(PREF_TENANT_USER_ID)
  if (prefPhone !== phone || raw === '' || raw == null) return undefined
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0 ? n : undefined
}

function readPrefActiveTenantId(phone) {
  const prefPhone = uni.getStorageSync(PREF_PHONE)
  const raw = uni.getStorageSync(PREF_ACTIVE_TENANT_ID)
  if (prefPhone !== phone || raw === '' || raw == null) return undefined
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0 ? n : undefined
}

function saveLoginPrefs(user) {
  uni.setStorageSync(PREF_PHONE, user.phone)
  uni.setStorageSync(PREF_TENANT_USER_ID, String(user.id))
  uni.setStorageSync(PREF_COMPANY_ID, String(user.companyId))
}

function saveActiveTenantPref(phone, tenantId) {
  uni.setStorageSync(PREF_PHONE, phone)
  uni.setStorageSync(PREF_ACTIVE_TENANT_ID, String(tenantId))
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: uni.getStorageSync('pms_token') || '',
    user: null,
    relationOptions: [],
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(phone, password, companyId, tenantUserId) {
      const storedCompany =
        companyId ??
        readPrefCompanyId(phone) ??
        (() => {
          const v = uni.getStorageSync('mp_company_id')
          return v !== '' && v != null ? Number(v) : undefined
        })()

      const storedTenantUserId = tenantUserId ?? readPrefTenantUserId(phone)
      const storedActiveTenantId = readPrefActiveTenantId(phone)

      const res = await post('/api/mp/login', {
        phone,
        password,
        type: 'tenant',
        ...(storedCompany != null && !Number.isNaN(storedCompany) && storedCompany > 0
          ? { companyId: storedCompany }
          : {}),
        ...(storedTenantUserId != null && storedTenantUserId > 0
          ? { tenantUserId: storedTenantUserId }
          : {}),
        ...(storedActiveTenantId != null && storedActiveTenantId > 0
          ? { activeTenantId: storedActiveTenantId }
          : {}),
      })

      if (res.needCompany && res.companies && res.companies.length) {
        return {
          needCompany: true,
          companies: res.companies,
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
      saveLoginPrefs(res.user)
      void this.fetchUser()
      return { ok: true }
    },

    async switchTenant(tenantUserId) {
      const res = await post('/api/mp/switch-tenant', { tenantUserId })
      if (!res.success || !res.token || !res.user) {
        throw new Error(res.message || '切换失败')
      }
      this.token = res.token
      this.user = res.user
      uni.setStorageSync('pms_token', res.token)
      uni.setStorageSync('mp_company_id', res.user.companyId)
      uni.setStorageSync('mp_tenant_user_id', res.user.id)
      saveLoginPrefs(this.user)
      uni.removeStorageSync(PREF_ACTIVE_TENANT_ID)
      void this.fetchUser()
    },

    async switchActiveTenant(tenantId) {
      const res = await post('/api/mp/switch-active-tenant', { tenantId })
      if (!res.success || !res.token || !res.user) {
        throw new Error(res.message || '切换失败')
      }
      this.token = res.token
      this.user = res.user
      uni.setStorageSync('pms_token', res.token)
      uni.setStorageSync('mp_company_id', res.user.companyId)
      uni.setStorageSync('mp_tenant_user_id', res.user.id)
      saveLoginPrefs(this.user)
      if (res.user.phone) {
        saveActiveTenantPref(res.user.phone, tenantId)
      }
      void this.fetchUser()
    },

    logout() {
      this.token = ''
      this.user = null
      this.relationOptions = []
      uni.removeStorageSync('pms_token')
      uni.removeStorageSync('mp_company_id')
      uni.removeStorageSync('mp_tenant_user_id')
    },

    async fetchUser() {
      if (!this.token) return
      try {
        const res = await get('/api/mp/me')
        if (res.success && res.user) {
          this.user = res.user
          this.relationOptions = Array.isArray(res.relationOptions) ? res.relationOptions : []
        }
      } catch {
        this.logout()
      }
    },
  },
})
