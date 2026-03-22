'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type CompanyOpt = { companyId: number; companyName: string }

const PREF_PHONE = 'mp_pref_phone'
const PREF_TENANT_USER_ID = 'mp_pref_tenant_user_id'
const PREF_COMPANY_ID = 'mp_pref_company_id'
const PREF_ACTIVE_TENANT_ID = 'mp_pref_active_tenant_id'

function readPrefs(phoneTrim: string) {
  if (typeof window === 'undefined') return {}
  const prefPhone = localStorage.getItem(PREF_PHONE)
  const companyRaw = localStorage.getItem(PREF_COMPANY_ID)
  const tenantRaw = localStorage.getItem(PREF_TENANT_USER_ID)
  const activeTenantRaw = localStorage.getItem(PREF_ACTIVE_TENANT_ID)
  const company =
    prefPhone === phoneTrim && companyRaw ? Number(companyRaw) : undefined
  const tenantUserId =
    prefPhone === phoneTrim && tenantRaw ? Number(tenantRaw) : undefined
  const activeTenantId =
    prefPhone === phoneTrim && activeTenantRaw ? Number(activeTenantRaw) : undefined
  return {
    ...(company != null && !Number.isNaN(company) && company > 0 ? { companyId: company } : {}),
    ...(tenantUserId != null && !Number.isNaN(tenantUserId) && tenantUserId > 0
      ? { tenantUserId }
      : {}),
    ...(activeTenantId != null && !Number.isNaN(activeTenantId) && activeTenantId > 0
      ? { activeTenantId }
      : {}),
  }
}

function savePrefs(user: { phone: string; id: number; companyId: number }) {
  localStorage.setItem(PREF_PHONE, user.phone)
  localStorage.setItem(PREF_TENANT_USER_ID, String(user.id))
  localStorage.setItem(PREF_COMPANY_ID, String(user.companyId))
}

export default function TenantLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [companies, setCompanies] = useState<CompanyOpt[] | null>(null)
  const [pickCompanyId, setPickCompanyId] = useState<number | null>(null)

  const submit = async (extra?: { companyId?: number; tenantUserId?: number }) => {
    setErr('')
    setLoading(true)
    try {
      const phoneTrim = phone.trim()
      const fromPrefs = readPrefs(phoneTrim)
      const res = await fetch('/api/mp/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: phoneTrim,
          password,
          type: 'tenant',
          ...fromPrefs,
          ...(extra?.companyId ? { companyId: extra.companyId } : {}),
          ...(extra?.tenantUserId ? { tenantUserId: extra.tenantUserId } : {}),
          ...(pickCompanyId && !extra?.companyId ? { companyId: pickCompanyId } : {}),
        }),
      })
      const j = await res.json()
      if (j.needCompany && j.companies) {
        setCompanies(j.companies)
        setLoading(false)
        return
      }
      if (!res.ok || !j.success) {
        setErr(j.message || '登录失败')
        setLoading(false)
        return
      }
      if (j.user?.phone && j.user?.id != null && j.user?.companyId != null) {
        savePrefs({
          phone: j.user.phone,
          id: j.user.id,
          companyId: j.user.companyId,
        })
      }
      router.replace('/m/tenant')
    } catch {
      setErr('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-6 max-w-md mx-auto">
      <Link href="/m" className="text-sm text-slate-500 mb-6">
        ← 返回
      </Link>
      <h1 className="text-2xl font-semibold mb-1">租客端登录</h1>
      <p className="text-sm text-slate-500 mb-8">
        使用租客小程序账号（手机号 + 密码）。同公司多租客账号将默认进入上次登录或最新创建的账号。
      </p>

      {companies && (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium">请选择物业公司</p>
          {companies.map((c) => (
            <button
              key={c.companyId}
              type="button"
              onClick={() => {
                setPickCompanyId(c.companyId)
                void submit({ companyId: c.companyId })
              }}
              className="w-full text-left py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {c.companyName}
            </button>
          ))}
        </div>
      )}

      {!companies && (
        <form
          className="space-y-4 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">手机号</label>
            <input
              type="tel"
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-base"
              placeholder="11 位手机号"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">密码</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-base"
              placeholder="至少 6 位"
            />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      )}

      {companies && (
        <button
          type="button"
          onClick={() => {
            setCompanies(null)
            setPickCompanyId(null)
          }}
          className="mt-4 text-sm text-slate-500"
        >
          返回重新输入
        </button>
      )}
    </div>
  )
}
