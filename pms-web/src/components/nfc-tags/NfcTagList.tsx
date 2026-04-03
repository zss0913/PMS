'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { NfcTagForm } from './NfcTagForm'

const INSPECTION_TYPE_OPTIONS = [
  { value: '工程', label: '工程' },
  { value: '安保', label: '安保' },
  { value: '设备', label: '设备' },
  { value: '绿化', label: '绿化' },
] as const

export type NfcTag = {
  id: number
  tagId: string
  buildingId: number
  buildingName: string
  location: string
  description: string | null
  inspectionType: string
  status?: string
}

type Building = { id: number; name: string }

export function NfcTagList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [list, setList] = useState<NfcTag[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTagId, setFilterTagId] = useState('')
  const [filterBuilding, setFilterBuilding] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterInspectionType, setFilterInspectionType] = useState<string>('')
  const [filterDescription, setFilterDescription] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<NfcTag | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/nfc-tags', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        const data = json.data
        setList(Array.isArray(data) ? data : data?.list ?? [])
        setBuildings(data?.buildings ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const filtered = list.filter((t) => {
    if (filterTagId.trim() && !t.tagId.includes(filterTagId.trim())) return false
    if (filterBuilding.trim() && !(t.buildingName ?? '').includes(filterBuilding.trim()))
      return false
    if (filterLocation.trim() && !t.location.includes(filterLocation.trim())) return false
    if (filterInspectionType && t.inspectionType !== filterInspectionType) return false
    if (filterDescription.trim() && !(t.description ?? '').includes(filterDescription.trim()))
      return false
    return true
  })
  const statusLabel = (s?: string) => (s === 'disabled' ? '停用' : '启用')
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const handleDelete = async (item: NfcTag) => {
    if (!confirm(`确定删除NFC标签「${item.tagId}」？`)) return
    setDeleting(item.id)
    try {
      const res = await fetch(`/api/nfc-tags/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) fetchData()
      else alert(json.message || '删除失败')
    } finally {
      setDeleting(null)
    }
  }

  const handleEdit = (item: NfcTag) => {
    setEditingTag(item)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingTag(null)
    fetchData()
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理NFC标签</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作NFC标签管理功能。</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:max-w-[200px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">NFC ID</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterTagId}
              onChange={(e) => setFilterTagId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:max-w-[200px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">所属楼宇</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterBuilding}
              onChange={(e) => setFilterBuilding(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:max-w-[200px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">位置名称</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[100px] w-full sm:w-auto sm:min-w-[120px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">巡检类型</label>
            <select
              value={filterInspectionType}
              onChange={(e) => setFilterInspectionType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部</option>
              {INSPECTION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:max-w-[220px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">说明</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingTag(null)
              setFormOpen(true)
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shrink-0 h-[38px] self-end"
          >
            <Plus className="w-4 h-4" />
            新增NFC标签
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">NFC ID</th>
              <th className="text-left p-4 font-medium">所属楼宇</th>
              <th className="text-left p-4 font-medium">位置名称</th>
              <th className="text-left p-4 font-medium">巡检类型</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium min-w-[120px] max-w-[280px]">说明</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-500">
                  加载中...
                </td>
              </tr>
            ) : (
              paginatedItems.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="p-4 font-medium">{t.tagId}</td>
                  <td className="p-4">{t.buildingName}</td>
                  <td className="p-4">{t.location}</td>
                  <td className="p-4">{t.inspectionType}</td>
                  <td className="p-4">{statusLabel(t.status)}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[280px]">
                    <span className="line-clamp-2 break-words" title={t.description ?? undefined}>
                      {t.description?.trim() ? t.description : '—'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(t)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={deleting === t.id}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
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
          暂无数据，点击「新增NFC标签」添加
        </div>
      )}
      {!loading && list.length > 0 && filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">没有符合当前筛选条件的数据</div>
      )}
      {!loading && filtered.length > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
      {formOpen && (
        <NfcTagForm
          tag={editingTag}
          buildings={buildings}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
