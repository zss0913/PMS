'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Download, Search } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { InspectionPointForm } from './InspectionPointForm'
import { INSPECTION_CATEGORIES } from '@/lib/inspection-point-types'

type DeviceRow = { id: number; code: string; name: string }

type PointRow = {
  id: number
  name: string
  inspectionCategory: string
  buildingId: number
  buildingName: string
  floorId: number | null
  floorName: string | null
  location: string
  description: string | null
  images: string[]
  status: string
  devices: DeviceRow[]
  nfcTagId: number | null
  nfcTag: {
    id: number
    tagId: string
    location: string
    inspectionType: string
  } | null
  createdAt: string
}

type Building = { id: number; name: string }

export function InspectionPointList() {
  const [list, setList] = useState<PointRow[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (buildingId) params.set('buildingId', buildingId)
      if (status) params.set('status', status)
      if (category) params.set('category', category)
      const res = await fetch(`/api/inspection-points?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        setList(json.data.list ?? [])
        setBuildings(json.data.buildings ?? [])
      }
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [q, buildingId, status, category])

  useEffect(() => {
    void load()
  }, [load])

  const exportCsv = () => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (buildingId) params.set('buildingId', buildingId)
    if (status) params.set('status', status)
    if (category) params.set('category', category)
    window.open(`/api/inspection-points/export?${params}`, '_blank')
  }

  const handleDelete = async (row: PointRow) => {
    if (!confirm(`确定删除巡检点「${row.name}」？`)) return
    setDeleting(row.id)
    try {
      const res = await fetch(`/api/inspection-points/${row.id}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json()
      if (json.success) load()
      else alert(json.message || '删除失败')
    } catch {
      alert('网络错误')
    } finally {
      setDeleting(null)
    }
  }

  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } = usePagination(
    list,
    15
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">关键词</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setQ(qInput.trim())
                }
              }}
              placeholder="名称 / 位置 / 描述"
              className="pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-56"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">巡检类型</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm min-w-[140px]"
          >
            <option value="">全部</option>
            {INSPECTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">楼宇</label>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm min-w-[140px]"
          >
            <option value="">全部</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">状态</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="">全部</option>
            <option value="enabled">启用</option>
            <option value="disabled">禁用</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setQ(qInput.trim())
          }}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
        >
          查询
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
        >
          <Download className="w-4 h-4" />
          导出
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
        >
          <Plus className="w-4 h-4" />
          新建巡检点
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-3 font-medium">名称</th>
              <th className="text-left p-3 font-medium">巡检类型</th>
              <th className="text-left p-3 font-medium">楼宇 / 楼层</th>
              <th className="text-left p-3 font-medium w-24">图片</th>
              <th className="text-left p-3 font-medium">位置</th>
              <th className="text-left p-3 font-medium">关联设备</th>
              <th className="text-left p-3 font-medium">NFC</th>
              <th className="text-left p-3 font-medium">状态</th>
              <th className="text-right p-3 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-slate-500">
                  加载中…
                </td>
              </tr>
            ) : (
              paginatedItems.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 whitespace-nowrap">{p.inspectionCategory}</td>
                  <td className="p-3">
                    {p.buildingName}
                    {p.floorName ? ` / ${p.floorName}` : ''}
                  </td>
                  <td className="p-3">
                    {p.images?.length ? (
                      <div className="flex gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.images[0]}
                          alt=""
                          className="w-12 h-12 rounded object-cover border border-slate-200"
                        />
                        {p.images.length > 1 && (
                          <span className="text-xs text-slate-500 self-end">+{p.images.length - 1}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={p.location}>
                    {p.location || '—'}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[180px] truncate">
                    {p.inspectionCategory === '设备巡检' && p.devices.length
                      ? p.devices.map((d) => d.code).join('、')
                      : '—'}
                  </td>
                  <td className="p-3 text-xs text-slate-600 dark:text-slate-300 max-w-[160px]">
                    {p.nfcTag ? (
                      <span title={p.nfcTag.location}>
                        {p.nfcTag.tagId}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">{p.status === 'enabled' ? '启用' : '禁用'}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(p.id)
                        setFormOpen(true)
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-600 inline-flex"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      disabled={deleting === p.id}
                      className="p-1.5 text-slate-500 hover:text-red-600 inline-flex disabled:opacity-50"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && list.length === 0 && (
          <div className="p-12 text-center text-slate-500">暂无数据</div>
        )}
        {!loading && list.length > 0 && (
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {formOpen && (
        <InspectionPointForm
          pointId={editingId}
          buildings={buildings}
          onClose={() => {
            setFormOpen(false)
            setEditingId(null)
          }}
          onSaved={() => {
            setFormOpen(false)
            setEditingId(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
