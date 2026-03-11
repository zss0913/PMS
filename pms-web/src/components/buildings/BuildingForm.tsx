'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Project = { id: number; name: string }

type FormData = {
  name: string
  area: string
  manager: string
  phone: string
  location: string
  projectId: number | null
}

export function BuildingForm({
  mode,
  id,
}: {
  mode: 'new' | 'edit'
  id?: number
}) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    area: '',
    manager: '',
    phone: '',
    location: '',
    projectId: null,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [projectsRes, buildingRes] = await Promise.all([
          fetch('/api/projects'),
          mode === 'edit' && id ? fetch(`/api/buildings/${id}`) : null,
        ])
        const projectsJson = await projectsRes.json()
        if (!projectsJson.success) {
          setError(projectsJson.message || '加载项目列表失败')
          return
        }
        const list = projectsJson.data?.list ?? []
        setProjects(list)

        if (mode === 'edit' && id && buildingRes) {
          const buildingJson = await buildingRes.json()
          if (!buildingJson.success) {
            setError(buildingJson.message || '加载楼宇失败')
            return
          }
          const b = buildingJson.data
          setForm({
            name: b.name ?? '',
            area: String(b.area ?? ''),
            manager: b.manager ?? '',
            phone: b.phone ?? '',
            location: b.location ?? '',
            projectId: b.projectId ?? b.project?.id ?? null,
          })
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
      alert('请输入楼宇名称')
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
    if (isNaN(areaNum) || areaNum < 0) {
      alert('请输入有效的面积')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        area: areaNum,
        manager: form.manager.trim(),
        phone: form.phone.trim(),
        location: form.location.trim() || null,
        projectId: form.projectId,
      }
      const url = mode === 'edit' && id ? `/api/buildings/${id}` : '/api/buildings'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        if (mode === 'edit' && id) {
          router.push(`/buildings/${id}`)
        } else {
          router.push('/buildings')
        }
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
        <Link
          href={mode === 'edit' && id ? `/buildings/${id}` : '/buildings'}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">楼宇名称 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入楼宇名称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">面积(㎡) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.area}
            onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入面积"
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
          <label className="block text-sm font-medium mb-2">位置（可选）</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入位置"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">所属项目（可选）</label>
          <select
            value={form.projectId ?? ''}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                projectId: e.target.value ? parseInt(e.target.value, 10) : null,
              }))
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">请选择项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
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
          <Link
            href={mode === 'edit' && id ? `/buildings/${id}` : '/buildings'}
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  )
}
