'use client'

import { useEffect, useState } from 'react'

type View = {
  tenantAppId: string
  staffAppId: string
  tenantAppSecretConfigured: boolean
  staffAppSecretConfigured: boolean
  tenantAppIdFromDb: boolean
  staffAppIdFromDb: boolean
  tenantAppSecretFromDb: boolean
  staffAppSecretFromDb: boolean
}

export function PlatformMpSettingsForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [tenantAppId, setTenantAppId] = useState('')
  const [staffAppId, setStaffAppId] = useState('')
  const [tenantAppSecret, setTenantAppSecret] = useState('')
  const [staffAppSecret, setStaffAppSecret] = useState('')
  const [clearTenantSecret, setClearTenantSecret] = useState(false)
  const [clearStaffSecret, setClearStaffSecret] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/platform/mp-settings')
        const json = await res.json()
        if (!json.success) {
          setError(json.message || '加载失败')
          return
        }
        const d = json.data as View
        setView(d)
        setTenantAppId(d.tenantAppId)
        setStaffAppId(d.staffAppId)
        setTenantAppSecret('')
        setStaffAppSecret('')
        setClearTenantSecret(false)
        setClearStaffSecret(false)
      } catch {
        setError('网络错误')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/mp-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantAppId,
          staffAppId,
          tenantAppSecret: tenantAppSecret.trim() || undefined,
          staffAppSecret: staffAppSecret.trim() || undefined,
          clearTenantAppSecret: clearTenantSecret,
          clearStaffAppSecret: clearStaffSecret,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '保存失败')
        return
      }
      const d = json.data as View
      setView(d)
      setTenantAppSecret('')
      setStaffAppSecret('')
      setClearTenantSecret(false)
      setClearStaffSecret(false)
      alert('已保存')
    } catch {
      setError('网络错误')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-w-2xl">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          此处配置全平台共用的微信小程序 AppId / AppSecret。租客端、员工端各一套；物业公司仅配置各自微信支付商户号与证书。数据库中的值优先于环境变量；未填写 Secret
          时可使用环境变量 <code className="text-xs bg-slate-100 dark:bg-slate-900 px-1 rounded">WECHAT_MP_*</code>。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">租客端小程序 AppId</label>
          <input
            type="text"
            value={tenantAppId}
            onChange={(e) => setTenantAppId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="与微信小程序后台一致"
          />
          {view && (
            <p className="mt-1 text-xs text-slate-500">
              当前生效来源：{view.tenantAppIdFromDb ? '本页已保存' : '环境变量或未配置'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">租客端小程序 AppSecret</label>
          <input
            type="password"
            value={tenantAppSecret}
            onChange={(e) => setTenantAppSecret(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="留空则不修改已保存的值"
            autoComplete="new-password"
          />
          {view && (
            <p className="mt-1 text-xs text-slate-500">
              状态：{view.tenantAppSecretConfigured ? '已配置（库或环境变量）' : '未配置'}
              {view.tenantAppSecretFromDb ? '（库内已保存）' : ''}
            </p>
          )}
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={clearTenantSecret}
              onChange={(e) => setClearTenantSecret(e.target.checked)}
            />
            清除库内已保存的租客端 Secret（改用环境变量）
          </label>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <label className="block text-sm font-medium mb-2">员工端小程序 AppId</label>
          <input
            type="text"
            value={staffAppId}
            onChange={(e) => setStaffAppId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="与微信小程序后台一致"
          />
          {view && (
            <p className="mt-1 text-xs text-slate-500">
              当前生效来源：{view.staffAppIdFromDb ? '本页已保存' : '环境变量或未配置'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">员工端小程序 AppSecret</label>
          <input
            type="password"
            value={staffAppSecret}
            onChange={(e) => setStaffAppSecret(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="留空则不修改已保存的值"
            autoComplete="new-password"
          />
          {view && (
            <p className="mt-1 text-xs text-slate-500">
              状态：{view.staffAppSecretConfigured ? '已配置（库或环境变量）' : '未配置'}
              {view.staffAppSecretFromDb ? '（库内已保存）' : ''}
            </p>
          )}
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={clearStaffSecret}
              onChange={(e) => setClearStaffSecret(e.target.checked)}
            />
            清除库内已保存的员工端 Secret（改用环境变量）
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
