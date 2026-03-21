'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type CompanyOpt = { companyId: number; companyName: string }
type TenantUserOpt = {
  id: number
  name: string
  companyId: number
  companyName: string
  tenants: { tenantId: number; companyName: string }[]
}

export default function TenantLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [companies, setCompanies] = useState<CompanyOpt[] | null>(null)
  const [tenantUsers, setTenantUsers] = useState<TenantUserOpt[] | null>(null)
  const [pickCompanyId, setPickCompanyId] = useState<number | null>(null)
  const [pickTenantUserId, setPickTenantUserId] = useState<number | null>(null)

  const submit = async (extra?: { companyId?: number; tenantUserId?: number }) => {
    setErr('')
    setLoading(true)
    try {
      const res = await fetch('/api/mp/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: phone.trim(),
          password,
          type: 'tenant',
          ...(extra?.companyId ? { companyId: extra.companyId } : {}),
          ...(extra?.tenantUserId ? { tenantUserId: extra.tenantUserId } : {}),
          ...(pickCompanyId && !extra?.companyId ? { companyId: pickCompanyId } : {}),
          ...(pickTenantUserId && !extra?.tenantUserId ? { tenantUserId: pickTenantUserId } : {}),
        }),
      })
      const j = await res.json()
      if (j.needCompany && j.companies) {
        setCompanies(j.companies)
        setTenantUsers(null)
        setLoading(false)
        return
      }
      if (j.needTenantUser && j.tenantUsers) {
        setTenantUsers(j.tenantUsers)
        setCompanies(null)
        setLoading(false)
        return
      }
      if (!res.ok || !j.success) {
        setErr(j.message || '登录失败')
        setLoading(false)
        return
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
      <p className="text-sm text-slate-500 mb-8">使用租客小程序账号（手机号 + 密码）</p>

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

      {tenantUsers && (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium">请选择要登录的账号</p>
          {tenantUsers.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setPickTenantUserId(u.id)
                void submit({ tenantUserId: u.id, companyId: u.companyId })
              }}
              className="w-full text-left py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <span className="font-medium">{u.name}</span>
              <span className="text-slate-500 text-sm ml-2">{u.companyName}</span>
            </button>
          ))}
        </div>
      )}

      {!companies && !tenantUsers && (
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

      {(companies || tenantUsers) && (
        <button
          type="button"
          onClick={() => {
            setCompanies(null)
            setTenantUsers(null)
            setPickCompanyId(null)
            setPickTenantUserId(null)
          }}
          className="mt-4 text-sm text-slate-500"
        >
          返回重新输入
        </button>
      )}
    </div>
  )
}
