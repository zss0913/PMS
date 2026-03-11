'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

type Tenant = {
  id: number
  type: string
  companyName: string
  buildingId: number
  building: { id: number; name: string }
  roomNumbers: string
  totalArea: number
  moveInDate: string
  leaseStartDate: string
  leaseEndDate: string
  employeeCount: number
  createdAt: string
}

type Building = { id: number; name: string }

type ApiData = {
  list: Tenant[]
  buildings: Building[]
}

export function TenantList() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    companyName: '',
    type: '',
    buildingId: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    companyName: '',
    type: '',
    buildingId: '',
  })
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (appliedFilters.companyName) params.set('companyName', appliedFilters.companyName)
      if (appliedFilters.type) params.set('type', appliedFilters.type)
      if (appliedFilters.buildingId) params.set('buildingId', appliedFilters.buildingId)
      const res = await fetch(`/api/tenants?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [appliedFilters.companyName, appliedFilters.type, appliedFilters.buildingId])

  const handleSearch = () => {
    setAppliedFilters(filters)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该租客吗？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        loadData()
      } else {
        alert(json.message || '删除失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  const list = data?.list ?? []
  const buildings = data?.buildings ?? []

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="公司名称"
              value={filters.companyName}
              onChange={(e) => setFilters((p) => ({ ...p, companyName: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <select
          value={filters.type}
          onChange={(e) => {
            const v = e.target.value
            setFilters((p) => ({ ...p, type: v }))
            setAppliedFilters((p) => ({ ...p, type: v }))
          }}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
        >
          <option value="">全部类型</option>
          <option value="租客">租客</option>
          <option value="业主">业主</option>
        </select>
        <select
          value={filters.buildingId}
          onChange={(e) => {
            const v = e.target.value
            setFilters((p) => ({ ...p, buildingId: v }))
            setAppliedFilters((p) => ({ ...p, buildingId: v }))
          }}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
        >
          <option value="">全部楼宇</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
        >
          <Search className="w-4 h-4" />
          筛选
        </button>
        <Link
          href="/tenants/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增租客
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">租客类型</th>
              <th className="text-left p-4 font-medium">公司名称</th>
              <th className="text-left p-4 font-medium">所属楼宇</th>
              <th className="text-left p-4 font-medium">租赁房号</th>
              <th className="text-left p-4 font-medium">租赁面积(㎡)</th>
              <th className="text-left p-4 font-medium">入住日期</th>
              <th className="text-left p-4 font-medium">租期起止</th>
              <th className="text-left p-4 font-medium">员工数量</th>
              <th className="text-left p-4 font-medium">创建时间</th>
              <th className="text-left p-4 font-medium w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-slate-500">
                  加载中...
                </td>
              </tr>
            ) : (
              list.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="p-4">{t.type}</td>
                  <td className="p-4">
                    <Link
                      href={`/tenants/${t.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {t.companyName}
                    </Link>
                  </td>
                  <td className="p-4">{t.building?.name || '-'}</td>
                  <td className="p-4">{t.roomNumbers || '-'}</td>
                  <td className="p-4">{t.totalArea}</td>
                  <td className="p-4">{formatDate(t.moveInDate)}</td>
                  <td className="p-4">
                    {formatDate(t.leaseStartDate)} ~ {formatDate(t.leaseEndDate)}
                  </td>
                  <td className="p-4">{t.employeeCount}</td>
                  <td className="p-4">{formatDateTime(t.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link
                        href={`/tenants/${t.id}`}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="租户详情"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/tenants/${t.id}/edit`}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded disabled:opacity-50"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && list.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增租客」添加
        </div>
      )}
    </div>
  )
}
