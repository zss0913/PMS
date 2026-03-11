'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Department = { id: number; name: string; parentId: number | null }
type Project = { id: number; name: string }
type Building = { id: number; name: string }
type Employee = { id: number; name: string }

type ApiData = {
  list: Department[]
  projects: Project[]
  buildings: Building[]
  employees: Employee[]
}

type FormData = {
  name: string
  parentId: number | null
  managerId: number | null
  projectIds: number[]
  buildingIds: number[]
}

function buildTreeOptions(
  depts: Department[],
  parentId: number | null,
  excludeId: number | undefined,
  depth = 0
): { id: number; name: string; label: string }[] {
  const result: { id: number; name: string; label: string }[] = []
  const children = depts.filter((d) => d.parentId === parentId && d.id !== excludeId)
  for (const d of children) {
    const prefix = '　'.repeat(depth)
    result.push({ id: d.id, name: d.name, label: prefix + d.name })
    result.push(...buildTreeOptions(depts, d.id, excludeId, depth + 1))
  }
  return result
}

export function DepartmentForm({
  mode,
  id,
}: {
  mode: 'new' | 'edit'
  id?: number
}) {
  const router = useRouter()
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    name: '',
    parentId: null,
    managerId: null,
    projectIds: [],
    buildingIds: [],
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/departments')
        const json = await res.json()
        if (!json.success) {
          setError(json.message || '加载失败')
          setData(null)
          return
        }
        setData(json.data)
        if (mode === 'edit' && id) {
          const dept = json.data.list.find((d: { id: number }) => d.id === id)
          if (dept) {
            setForm({
              name: dept.name,
              parentId: dept.parentId,
              managerId: dept.managerId,
              projectIds: dept.projectIds ?? [],
              buildingIds: dept.buildingIds ?? [],
            })
          } else {
            setError('部门不存在')
          }
        }
      } catch (e) {
        setError('网络错误')
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [mode, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('请输入部门名称')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        parentId: form.parentId,
        managerId: form.managerId,
        projectIds: form.projectIds,
        buildingIds: form.buildingIds,
      }
      const url = mode === 'edit' && id ? `/api/departments/${id}` : '/api/departments'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        router.push('/departments')
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

  const toggleProject = (projectId: number) => {
    setForm((prev) => ({
      ...prev,
      projectIds: prev.projectIds.includes(projectId)
        ? prev.projectIds.filter((x) => x !== projectId)
        : [...prev.projectIds, projectId],
    }))
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

  const list = data?.list ?? []
  const projects = data?.projects ?? []
  const buildings = data?.buildings ?? []
  const employees = data?.employees ?? []

  const parentOptions = buildTreeOptions(list, null, mode === 'edit' ? id : undefined)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <Link
          href="/departments"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">部门名称 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入部门名称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">上级部门</label>
          <select
            value={form.parentId ?? ''}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                parentId: e.target.value ? parseInt(e.target.value, 10) : null,
              }))
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">无（顶级部门）</option>
            {parentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">部门负责人</label>
          <select
            value={form.managerId ?? ''}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                managerId: e.target.value ? parseInt(e.target.value, 10) : null,
              }))
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">请选择</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">负责项目</label>
          <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 max-h-40 overflow-y-auto bg-white dark:bg-slate-700">
            {projects.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无项目</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.projectIds.includes(p.id)}
                      onChange={() => toggleProject(p.id)}
                      className="rounded"
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">负责楼宇</label>
          <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 max-h-40 overflow-y-auto bg-white dark:bg-slate-700">
            {buildings.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无楼宇</p>
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
          <Link
            href="/departments"
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  )
}
