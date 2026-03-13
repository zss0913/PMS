'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'

type FormData = {
  name: string
  contact: string
  phone: string
  address: string
  appId: string
  appSecret: string
  status: 'active' | 'inactive'
}

export function CompanyForm({
  mode,
  id,
}: {
  mode: 'new' | 'edit'
  id?: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(!!id)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    contact: '',
    phone: '',
    address: '',
    appId: '',
    appSecret: '',
    status: 'active',
  })

  useEffect(() => {
    if (mode !== 'edit' || !id) {
      setLoading(false)
      return
    }
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/companies/${id}`)
        const json = await res.json()
        if (!json.success) {
          setError(json.message || '加载失败')
          return
        }
        const c = json.data
        setForm({
          name: c.name ?? '',
          contact: c.contact ?? '',
          phone: c.phone ?? '',
          address: c.address ?? '',
          appId: c.appId ?? '',
          appSecret: c.appSecret ?? '',
          status: c.status === 'inactive' ? 'inactive' : 'active',
        })
      } catch (e) {
        setError('网络错误')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [mode, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('请输入公司名称')
      return
    }
    if (!form.contact.trim()) {
      alert('请输入联系人')
      return
    }
    if (!form.phone.trim()) {
      alert('请输入联系电话')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        appId: form.appId.trim() || null,
        appSecret: form.appSecret.trim() || null,
        status: form.status,
      }
      const url = mode === 'edit' && id ? `/api/companies/${id}` : '/api/companies'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        router.push('/companies')
        router.refresh()
      } else {
        alert(json.message || '保存失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <AppLink
          href="/companies"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </AppLink>
      </div>
      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">公司名称 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入公司名称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">联系人 *</label>
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入联系人"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">联系电话 *</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入联系电话"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">地址</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入地址（可选）"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">AppId</label>
          <input
            type="text"
            value={form.appId}
            onChange={(e) => setForm((p) => ({ ...p, appId: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入 AppId（可选）"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">AppSecret</label>
          <input
            type="text"
            value={form.appSecret}
            onChange={(e) => setForm((p) => ({ ...p, appSecret: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入 AppSecret（可选）"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">状态 *</label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm((p) => ({ ...p, status: e.target.value as 'active' | 'inactive' }))
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
          <AppLink
            href="/companies"
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </AppLink>
        </div>
      </form>
    </div>
  )
}
