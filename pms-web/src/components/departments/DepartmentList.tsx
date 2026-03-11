'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react'

type Department = {
  id: number
  name: string
  parentId: number | null
  parent: { id: number; name: string } | null
  managerId: number | null
  manager: { id: number; name: string } | null
  projectIds: number[]
  buildingIds: number[]
  employeeCount: number
}

type Project = { id: number; name: string }
type Building = { id: number; name: string }

type ApiData = {
  list: Department[]
  projects: Project[]
  buildings: Building[]
}

export function DepartmentList({
  isSuperAdmin,
}: {
  isSuperAdmin: boolean
}) {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchData = async () => {
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
    } catch (e) {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该部门吗？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchData()
      } else {
        alert(json.message || '删除失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理部门</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作部门管理功能。</p>
      </div>
    )
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

  const getProjectNames = (ids: number[]) => {
    return ids.map((id) => projects.find((p) => p.id === id)?.name).filter(Boolean).join('、') || '-'
  }
  const getBuildingNames = (ids: number[]) => {
    return ids.map((id) => buildings.find((b) => b.id === id)?.name).filter(Boolean).join('、') || '-'
  }

  const filtered = list.filter(
    (d) =>
      !keyword ||
      d.name.includes(keyword) ||
      d.parent?.name?.includes(keyword) ||
      d.manager?.name?.includes(keyword)
  )

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索部门名称、上级部门、负责人"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <Link
          href="/departments/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增部门
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">部门名称</th>
              <th className="text-left p-4 font-medium">上级部门</th>
              <th className="text-left p-4 font-medium">部门负责人</th>
              <th className="text-left p-4 font-medium">负责项目</th>
              <th className="text-left p-4 font-medium">负责楼宇</th>
              <th className="text-left p-4 font-medium">员工数量</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr
                key={d.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{d.name}</td>
                <td className="p-4">{d.parent?.name ?? '-'}</td>
                <td className="p-4">{d.manager?.name ?? '-'}</td>
                <td className="p-4">{getProjectNames(d.projectIds)}</td>
                <td className="p-4">{getBuildingNames(d.buildingIds)}</td>
                <td className="p-4">{d.employeeCount}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <Link
                      href={`/departments/${d.id}/edit`}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={deletingId === d.id}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增部门」添加
        </div>
      )}
    </div>
  )
}
