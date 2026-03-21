'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function StaffLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  return (
    <div className="min-h-[100dvh] flex flex-col p-6 max-w-md mx-auto">
      <Link href="/m" className="text-sm text-slate-500 mb-6">
        ← 返回
      </Link>
      <h1 className="text-2xl font-semibold mb-1">员工端登录</h1>
      <p className="text-sm text-slate-500 mb-8">物业员工手机号 + 密码（与 PC 端相同账号）</p>

      <form
        className="space-y-4 flex-1"
        onSubmit={async (e) => {
          e.preventDefault()
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
                type: 'employee',
              }),
            })
            const j = await res.json()
            if (!res.ok || !j.success) {
              setErr(j.message || '登录失败')
              return
            }
            router.replace('/m/staff')
          } catch {
            setErr('网络错误')
          } finally {
            setLoading(false)
          }
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
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-slate-800 text-white font-medium dark:bg-slate-700 disabled:opacity-50"
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}
