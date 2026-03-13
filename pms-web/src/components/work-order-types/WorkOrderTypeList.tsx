'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { WorkOrderTypeForm } from './WorkOrderTypeForm'

export type WorkOrderType = {
  id: number
  name: string
  sort: number
  enabled: boolean
  workOrderCount: number
  responseTimeoutHours?: number | null
  notifyLeaderOnTimeout?: boolean
}

export function WorkOrderTypeList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [list, setList] = useState<WorkOrderType[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingType, setEditingType] = useState<WorkOrderType | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/work-order-types', { credentials: 'include' })
      const json = await res.json()
      if (json.success) setList(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const filtered = list.filter(
    (t) => !keyword || t.name.includes(keyword)
  )
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const handleDelete = async (item: WorkOrderType) => {
    if (!confirm(`确定删除工单类型「${item.name}」？`)) return
    setDeleting(item.id)
    try {
      const res = await fetch(`/api/work-order-types/${item.id}`, {
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

  const handleEdit = (item: WorkOrderType) => {
    setEditingType(item)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingType(null)
    fetchData()
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理工单类型</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作工单类型管理功能。</p>
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
              placeholder="搜索类型名称"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingType(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增工单类型
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">类型名称</th>
              <th className="text-left p-4 font-medium">排序</th>
              <th className="text-left p-4 font-medium">是否启用</th>
              <th className="text-left p-4 font-medium">响应超时</th>
              <th className="text-left p-4 font-medium">超时提醒组长</th>
              <th className="text-left p-4 font-medium">工单数量</th>
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
                  <td className="p-4 font-medium">{t.name}</td>
                  <td className="p-4">{t.sort}</td>
                  <td className="p-4">
                    <span
                      className={
                        t.enabled
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-slate-500'
                      }
                    >
                      {t.enabled ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    {t.responseTimeoutHours != null && t.responseTimeoutHours > 0
                      ? `${t.responseTimeoutHours} 小时`
                      : '不启用'}
                  </td>
                  <td className="p-4 text-sm">
                    {t.notifyLeaderOnTimeout ? '是' : '否'}
                  </td>
                  <td className="p-4">{t.workOrderCount}</td>
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
                        disabled={deleting === t.id || t.workOrderCount > 0}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t.workOrderCount > 0 ? '该类型下有工单，无法删除' : '删除'}
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
          暂无数据，点击「新增工单类型」添加
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
        <WorkOrderTypeForm
          type={editingType}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
