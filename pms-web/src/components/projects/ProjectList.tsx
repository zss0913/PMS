'use client'

import { useState, useEffect } from 'react'
import { AppLink } from '@/components/AppLink'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Project = {
  id: number
  name: string
  location: string | null
  area: number
  greenArea: number
  manager: string
  phone: string
  buildingIds: number[]
  buildingCount: number
  createdAt: string
}

type ApiData = {
  list: Project[]
  buildings: { id: number; name: string }[]
}

export function ProjectList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = keyword ? `/api/projects?keyword=${encodeURIComponent(keyword)}` : '/api/projects'
      const res = await fetch(url)
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

  const list = data?.list ?? []
  const filtered = list
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const handleSearch = () => {
    if (!isSuperAdmin) fetchData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该项目吗？关联的楼宇将解除关联。')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
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
        <p className="font-medium">超级管理员账号无法管理项目</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作项目管理功能。</p>
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative flex gap-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="按项目名称搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500"
            >
              搜索
            </button>
          </div>
        </div>
        <AppLink
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增项目
        </AppLink>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">项目名称</th>
              <th className="text-left p-4 font-medium">位置</th>
              <th className="text-left p-4 font-medium">占地面积(㎡)</th>
              <th className="text-left p-4 font-medium">绿化面积(㎡)</th>
              <th className="text-left p-4 font-medium">负责人</th>
              <th className="text-left p-4 font-medium">联系电话</th>
              <th className="text-left p-4 font-medium">关联楼宇</th>
              <th className="text-left p-4 font-medium">创建时间</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((p) => (
              <tr
                key={p.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{p.name}</td>
                <td className="p-4">{p.location || '-'}</td>
                <td className="p-4">{p.area}</td>
                <td className="p-4">{p.greenArea}</td>
                <td className="p-4">{p.manager}</td>
                <td className="p-4">{p.phone}</td>
                <td className="p-4">{p.buildingCount}</td>
                <td className="p-4">{formatDate(p.createdAt)}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <AppLink
                      href={`/projects/${p.id}/edit`}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </AppLink>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
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
          暂无数据，点击「新增项目」添加
        </div>
      )}
      {filtered.length > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
