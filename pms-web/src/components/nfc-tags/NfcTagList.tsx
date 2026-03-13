'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { NfcTagForm } from './NfcTagForm'

export type NfcTag = {
  id: number
  tagId: string
  buildingId: number
  buildingName: string
  location: string
  description: string | null
  inspectionType: string
}

type Building = { id: number; name: string }

export function NfcTagList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [list, setList] = useState<NfcTag[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
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

  const filtered = list.filter(
    (t) =>
      !keyword ||
      t.tagId.includes(keyword) ||
      t.buildingName?.includes(keyword) ||
      t.location.includes(keyword) ||
      t.inspectionType.includes(keyword)
  )
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
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索NFC ID、楼宇、位置、巡检类型"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingTag(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增NFC标签
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">NFC ID</th>
              <th className="text-left p-4 font-medium">所属楼宇</th>
              <th className="text-left p-4 font-medium">位置名称</th>
              <th className="text-left p-4 font-medium">巡检类型</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-500">
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
      {!loading && filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增NFC标签」添加
        </div>
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
