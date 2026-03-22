'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SwitchOpt = {
  tenantUserId: number
  tenantId: number
  buildingId: number
  tenantName: string
  propertyCompanyName: string
  accountName: string
  isCurrent: boolean
}

type RelationOpt = {
  tenantId: number
  buildingId: number
  isAdmin: boolean
  tenantName?: string
}

const PREF_PHONE = 'mp_pref_phone'
const PREF_TENANT_USER_ID = 'mp_pref_tenant_user_id'
const PREF_COMPANY_ID = 'mp_pref_company_id'
const PREF_ACTIVE_TENANT_ID = 'mp_pref_active_tenant_id'

function savePrefs(user: { phone: string; id: number; companyId: number }) {
  localStorage.setItem(PREF_PHONE, user.phone)
  localStorage.setItem(PREF_TENANT_USER_ID, String(user.id))
  localStorage.setItem(PREF_COMPANY_ID, String(user.companyId))
}

export default function TenantMePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [currentRelations, setCurrentRelations] = useState<RelationOpt[]>([])
  const [switchOptions, setSwitchOptions] = useState<SwitchOpt[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [me, sw] = await Promise.all([
      fetch('/api/mp/me', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/mp/tenant-switch-options', { credentials: 'include' }).then((r) => r.json()),
    ])
    if (me.user) {
      setName(me.user.name ?? '')
      setPhone(me.user.phone ?? '')
      setCurrentUserId(typeof me.user.id === 'number' ? me.user.id : null)
      if (Array.isArray(me.user.relations)) {
        setCurrentRelations(me.user.relations as RelationOpt[])
      } else {
        setCurrentRelations([])
      }
    }
    if (sw.success && Array.isArray(sw.data)) {
      setSwitchOptions(sw.data as SwitchOpt[])
    } else {
      setSwitchOptions([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeTenantLabel = useMemo(() => {
    if (currentRelations.length === 0) return ''
    if (currentRelations.length === 1) {
      const n = currentRelations[0].tenantName
      return n ? `当前租客：${n}` : ''
    }
    const names = currentRelations.map((r) => r.tenantName).filter(Boolean) as string[]
    return names.length ? `数据范围：${names.join('、')}` : ''
  }, [currentRelations])

  const showSwitch = switchOptions.some((o) => !o.isCurrent)

  const applySwitch = async (opt: SwitchOpt) => {
    if (opt.isCurrent || busy || currentUserId == null) return
    setBusy(true)
    try {
      if (opt.tenantUserId !== currentUserId) {
        const res = await fetch('/api/mp/switch-tenant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tenantUserId: opt.tenantUserId }),
        })
        const j = await res.json()
        if (!res.ok || !j.success || !j.user) {
          alert(j.message || '切换失败')
          return
        }
        savePrefs({
          phone: j.user.phone,
          id: j.user.id,
          companyId: j.user.companyId,
        })
        localStorage.removeItem(PREF_ACTIVE_TENANT_ID)
      }
      const res2 = await fetch('/api/mp/switch-active-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: opt.tenantId }),
      })
      const j2 = await res2.json()
      if (!res2.ok || !j2.success || !j2.user) {
        alert(j2.message || '切换失败')
        return
      }
      savePrefs({
        phone: j2.user.phone,
        id: j2.user.id,
        companyId: j2.user.companyId,
      })
      localStorage.setItem(PREF_ACTIVE_TENANT_ID, String(opt.tenantId))
      setPanelOpen(false)
      await load()
    } catch {
      alert('网络错误')
    } finally {
      setBusy(false)
    }
  }

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
        {(activeTenantLabel || showSwitch) && (
          <div className="flex items-start gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p
              className={`text-sm flex-1 min-w-0 ${activeTenantLabel ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {activeTenantLabel || '已关联多个租客公司，可切换查看'}
            </p>
            {showSwitch && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setPanelOpen(true)}
                className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-full border border-sky-500/50 text-sky-600 dark:text-sky-400 disabled:opacity-50"
              >
                切换租客
              </button>
            )}
          </div>
        )}
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

      {panelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0"
          onClick={() => !busy && setPanelOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && !busy && setPanelOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-t-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-panel-title"
          >
            <h2 id="switch-panel-title" className="text-center font-semibold text-base">
              选择租客公司
            </h2>
            <p className="text-center text-xs text-slate-500 mt-1 mb-3">
              同一手机号下已关联的租客主体均可在此切换
            </p>
            <div className="overflow-y-auto flex-1 min-h-0 space-y-2 mb-3">
              {switchOptions.map((opt, idx) => (
                <button
                  key={`${opt.tenantUserId}-${opt.tenantId}-${idx}`}
                  type="button"
                  disabled={busy || opt.isCurrent}
                  onClick={() => void applySwitch(opt)}
                  className="w-full text-left py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 disabled:opacity-50"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{opt.tenantName || `#${opt.tenantId}`}</span>
                    {opt.isCurrent && (
                      <span className="text-xs text-sky-600 dark:text-sky-400 shrink-0">当前</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {opt.propertyCompanyName} · {opt.accountName}
                  </p>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPanelOpen(false)}
              className="w-full py-3 text-slate-600 dark:text-slate-400"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
