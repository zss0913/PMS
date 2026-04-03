import { defineStore } from 'pinia'
import { post, get } from '@/api/request'

export interface TenantRelation {
  tenantId: number
  buildingId: number
  isAdmin: boolean
  /** 服务端 JWT / me 可能带上，便于展示当前所属租客 */
  tenantName?: string
}

export interface MpUser {
  id: number
  name: string
  phone: string
  type: 'tenant' | 'employee'
  companyId: number
  relations?: TenantRelation[]
}

const PREF_PHONE = 'mp_pref_phone'
const PREF_TENANT_USER_ID = 'mp_pref_tenant_user_id'
const PREF_COMPANY_ID = 'mp_pref_company_id'
const PREF_ACTIVE_TENANT_ID = 'mp_pref_active_tenant_id'

function readPrefCompanyId(phone: string): number | undefined {
  const prefPhone = uni.getStorageSync(PREF_PHONE) as string
  const raw = uni.getStorageSync(PREF_COMPANY_ID)
  if (prefPhone !== phone || raw === '' || raw == null) return undefined
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0 ? n : undefined
}

function readPrefTenantUserId(phone: string): number | undefined {
  const prefPhone = uni.getStorageSync(PREF_PHONE) as string
  const raw = uni.getStorageSync(PREF_TENANT_USER_ID)
  if (prefPhone !== phone || raw === '' || raw == null) return undefined
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0 ? n : undefined
}

function readPrefActiveTenantId(phone: string): number | undefined {
  const prefPhone = uni.getStorageSync(PREF_PHONE) as string
  const raw = uni.getStorageSync(PREF_ACTIVE_TENANT_ID)
  if (prefPhone !== phone || raw === '' || raw == null) return undefined
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0 ? n : undefined
}

function saveLoginPrefs(user: MpUser) {
  uni.setStorageSync(PREF_PHONE, user.phone)
  uni.setStorageSync(PREF_TENANT_USER_ID, String(user.id))
  uni.setStorageSync(PREF_COMPANY_ID, String(user.companyId))
}

function saveActiveTenantPref(phone: string, tenantId: number) {
  uni.setStorageSync(PREF_PHONE, phone)
  uni.setStorageSync(PREF_ACTIVE_TENANT_ID, String(tenantId))
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: uni.getStorageSync('pms_token') || '',
    user: null as MpUser | null,
    /** 账号在库中关联的全部租客主体（用于「切换所属租客」菜单，与 JWT 当前范围无关） */
    relationOptions: [] as TenantRelation[],
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    /**
     * 登录：多租客账号时服务端默认选「上次偏好」或「最新创建」；不再弹窗选择。
     * 登出后仍保留 mp_pref_*，下次同手机号优先恢复上次账号。
     */
    async login(phone: string, password: string, companyId?: number, tenantUserId?: number) {
      const storedCompany =
        companyId ??
        readPrefCompanyId(phone) ??
        (() => {
          const v = uni.getStorageSync('mp_company_id')
          return v !== '' && v != null ? Number(v) : undefined
        })()

      const storedTenantUserId = tenantUserId ?? readPrefTenantUserId(phone)
      const storedActiveTenantId = readPrefActiveTenantId(phone)

      const res = await post<{
        token?: string
        user?: MpUser
        needCompany?: boolean
        companies?: { companyId: number; companyName: string }[]
        message?: string
      }>('/api/mp/login', {
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

      if (res.needCompany && res.companies?.length) {
        return {
          needCompany: true as const,
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
      // 登录接口已返回 user/relations；不阻塞在 me，避免第二跳挂死导致一直「登录中」
      void this.fetchUser()
      return { ok: true as const }
    },

    async switchTenant(tenantUserId: number) {
      const res = await post<{
        success: boolean
        token?: string
        user?: MpUser
        message?: string
      }>('/api/mp/switch-tenant', { tenantUserId })
      if (!res.success || !res.token || !res.user) {
        throw new Error(res.message || '切换失败')
      }
      this.token = res.token
      this.user = res.user
      uni.setStorageSync('pms_token', res.token)
      uni.setStorageSync('mp_company_id', res.user.companyId)
      uni.setStorageSync('mp_tenant_user_id', res.user.id)
      saveLoginPrefs(res.user)
      uni.removeStorageSync(PREF_ACTIVE_TENANT_ID)
      void this.fetchUser()
    },

    /** 同一租客账号下切换当前所属租客主体（收窄数据范围） */
    async switchActiveTenant(tenantId: number) {
      const res = await post<{
        success: boolean
        token?: string
        user?: MpUser
        message?: string
      }>('/api/mp/switch-active-tenant', { tenantId })
      if (!res.success || !res.token || !res.user) {
        throw new Error(res.message || '切换失败')
      }
      this.token = res.token
      this.user = res.user
      uni.setStorageSync('pms_token', res.token)
      uni.setStorageSync('mp_company_id', res.user.companyId)
      uni.setStorageSync('mp_tenant_user_id', res.user.id)
      saveLoginPrefs(res.user)
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
      // 保留 mp_pref_phone / mp_pref_tenant_user_id / mp_pref_company_id 供下次登录默认进入
    },

    setUser(user: MpUser | null) {
      this.user = user
    },

    async fetchUser() {
      if (!this.token) return
      try {
        const res = (await get('/api/mp/me')) as {
          success?: boolean
          user?: MpUser
          relationOptions?: TenantRelation[]
        }
        if (res.success && res.user) {
          this.user = res.user as MpUser
          this.relationOptions = Array.isArray(res.relationOptions)
            ? res.relationOptions
            : []
        }
      } catch {
        this.logout()
      }
    },
  },
})
