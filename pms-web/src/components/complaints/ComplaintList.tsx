'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Search, CheckCircle } from 'lucide-react'

type Complaint = {
  id: number
  tenantId: number
  complainant: string
  description: string
  buildingId: number
  buildingName: string
  status: string
  createdAt: string
}

type Tenant = { id: number; companyName: string }
type Building = { id: number; name: string }

type ApiData = {
  list: Complaint[]
  tenants: Tenant[]
  buildings: Building[]
}

export function ComplaintList({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean
}) {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [handlingId, setHandlingId] = useState<number | null>(null)

  const [form, setForm] = useState({
    buildingId: 0,
    tenantId: 0,
    location: '',
    description: '',
  })

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/complaints')
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
  const tenants = data?.tenants ?? []
  const buildings = data?.buildings ?? []
  const statusLabel: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
  }
  const complaintCode = (id: number) => 'C' + String(id).padStart(5, '0')
  const filtered = list.filter(
    (c) =>
      !keyword ||
      complaintCode(c.id).includes(keyword.toUpperCase()) ||
      c.complainant.includes(keyword) ||
      c.description.includes(keyword) ||
      c.buildingName.includes(keyword) ||
      statusLabel[c.status]?.includes(keyword) ||
      c.status.includes(keyword)
  )
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.buildingId || !form.tenantId || !form.location.trim() || !form.description.trim()) {
      alert('请填写完整信息')
      return
    }
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setShowAdd(false)
        setForm({ buildingId: 0, tenantId: 0, location: '', description: '' })
        fetchData()
      } else {
        alert(json.message || '新增失败')
      }
    } catch (e) {
      alert('网络错误')
    }
  }

  const handleStatus = async (id: number, status: string) => {
    setHandlingId(id)
    try {
      const res = await fetch(`/api/complaints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success) {
        fetchData()
      } else {
        alert(json.message || '更新失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setHandlingId(null)
    }
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理卫生吐槽</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
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

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('zh-CN')
    } catch {
      return s
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索投诉编号、投诉人、投诉内容、楼宇、状态"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增投诉
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">楼宇</label>
              <select
                value={form.buildingId}
                onChange={(e) => setForm({ ...form, buildingId: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              >
                <option value={0}>请选择楼宇</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">投诉人（租客）</label>
              <select
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              >
                <option value={0}>请选择租客</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">位置</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="如：3楼卫生间"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">投诉内容</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="请描述投诉内容"
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              提交
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600"
            >
              取消
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">投诉编号</th>
              <th className="text-left p-4 font-medium">投诉人</th>
              <th className="text-left p-4 font-medium">投诉内容</th>
              <th className="text-left p-4 font-medium">楼宇</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">创建时间</th>
              <th className="text-left p-4 font-medium w-40">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{complaintCode(c.id)}</td>
                <td className="p-4">{c.complainant}</td>
                <td className="p-4 max-w-[200px] truncate" title={c.description}>
                  {c.description}
                </td>
                <td className="p-4">{c.buildingName}</td>
                <td className="p-4">{statusLabel[c.status] ?? c.status}</td>
                <td className="p-4">{formatDate(c.createdAt)}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    {c.status !== 'processing' && c.status !== 'completed' && (
                      <button
                        onClick={() => handleStatus(c.id, 'processing')}
                        disabled={handlingId === c.id}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                        title="标记为处理中"
                      >
                        处理中
                      </button>
                    )}
                    {c.status !== 'completed' && (
                      <button
                        onClick={() => handleStatus(c.id, 'completed')}
                        disabled={handlingId === c.id}
                        className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                        title="标记为已完成"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无投诉，点击「新增投诉」添加
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
