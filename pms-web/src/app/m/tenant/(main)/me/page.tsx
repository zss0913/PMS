'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function TenantMePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    void (async () => {
      const j = await fetch('/api/mp/me', { credentials: 'include' }).then((r) => r.json())
      if (j.user) {
        setName(j.user.name ?? '')
        setPhone(j.user.phone ?? '')
      }
    })()
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.replace('/m/tenant/login')
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <h1 className="text-lg font-semibold">我的</h1>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-2">
        <p className="text-sm text-slate-500">姓名</p>
        <p className="font-medium">{name || '-'}</p>
        <p className="text-sm text-slate-500 pt-2">手机号</p>
        <p className="font-mono">{phone || '-'}</p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium dark:border-red-900 dark:text-red-400"
      >
        退出登录
      </button>
      <Link href="/m" className="block text-center text-sm text-slate-500">
        切换端入口
      </Link>
    </div>
  )
}
