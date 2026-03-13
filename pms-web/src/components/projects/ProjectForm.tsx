'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'

type Building = { id: number; name: string }

type FormData = {
  name: string
  location: string
  area: string
  greenArea: string
  manager: string
  phone: string
  buildingIds: number[]
}

export function ProjectForm({
  mode,
  id,
}: {
  mode: 'new' | 'edit'
  id?: number
}) {
  const router = useRouter()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    location: '',
    area: '',
    greenArea: '',
    manager: '',
    phone: '',
    buildingIds: [],
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        if (mode === 'edit' && id) {
          const res = await fetch(`/api/projects/${id}`)
          const json = await res.json()
          if (!json.success) {
            setError(json.message || '加载失败')
            return
          }
          const p = json.data
          setBuildings(p.buildings ?? [])
          setForm({
            name: p.name,
            location: p.location ?? '',
            area: String(p.area ?? ''),
            greenArea: String(p.greenArea ?? ''),
            manager: p.manager ?? '',
            phone: p.phone ?? '',
            buildingIds: p.buildingIds ?? [],
          })
        } else {
          const res = await fetch('/api/projects')
          const json = await res.json()
          if (!json.success) {
            setError(json.message || '加载失败')
            return
          }
          setBuildings(json.data.buildings ?? [])
        }
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
      alert('请输入项目名称')
      return
    }
    if (!form.manager.trim()) {
      alert('请输入负责人')
      return
    }
    if (!form.phone.trim()) {
      alert('请输入联系电话')
      return
    }
    const areaNum = parseFloat(form.area)
    const greenNum = parseFloat(form.greenArea)
    if (isNaN(areaNum) || areaNum < 0) {
      alert('请输入有效的占地面积')
      return
    }
    if (isNaN(greenNum) || greenNum < 0) {
      alert('请输入有效的绿化面积')
      return
    }
    if (form.buildingIds.length === 0) {
      alert('请至少选择一个关联楼宇')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        area: areaNum,
        greenArea: greenNum,
        manager: form.manager.trim(),
        phone: form.phone.trim(),
        buildingIds: form.buildingIds,
      }
      const url = mode === 'edit' && id ? `/api/projects/${id}` : '/api/projects'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        router.push('/projects')
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

  const toggleBuilding = (buildingId: number) => {
    setForm((prev) => ({
      ...prev,
      buildingIds: prev.buildingIds.includes(buildingId)
        ? prev.buildingIds.filter((x) => x !== buildingId)
        : [...prev.buildingIds, buildingId],
    }))
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
          href="/projects"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </AppLink>
      </div>
      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">项目名称 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入项目名称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">位置</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入位置（可选）"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">占地面积(㎡) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.area}
            onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入占地面积"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">绿化面积(㎡) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.greenArea}
            onChange={(e) => setForm((p) => ({ ...p, greenArea: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入绿化面积"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">负责人 *</label>
          <input
            type="text"
            value={form.manager}
            onChange={(e) => setForm((p) => ({ ...p, manager: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入负责人"
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
          <label className="block text-sm font-medium mb-2">关联楼宇 *（至少选择一个）</label>
          <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 max-h-40 overflow-y-auto bg-white dark:bg-slate-700">
            {buildings.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无楼宇，请先在楼宇管理中添加</p>
            ) : (
              <div className="space-y-2">
                {buildings.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.buildingIds.includes(b.id)}
                      onChange={() => toggleBuilding(b.id)}
                      className="rounded"
                    />
                    <span>{b.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
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
            href="/projects"
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </AppLink>
        </div>
      </form>
    </div>
  )
}
