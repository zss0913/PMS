'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { PermissionGate } from '@/components/permissions/PermissionGate'
import { MENU_ID } from '@/lib/menu-config'
import { Plus, Pencil, Trash2, Upload, Download } from 'lucide-react'
import { DeviceForm } from './DeviceForm'
import { DeviceBatchImportModal } from './DeviceBatchImportModal'

export type Device = {
  id: number
  code: string
  name: string
  type: string
  buildingId: number
  buildingName: string
  status: string
  commissionedDate?: string
  location?: string
  maintenanceContact?: string
  supplier?: string
  brand?: string
}

type Building = { id: number; name: string }

const DEVICE_STATUS_OPTIONS = [
  { value: '正常', label: '正常' },
  { value: '维修中', label: '维修中' },
  { value: '报废', label: '报废' },
] as const

export function DeviceList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [list, setList] = useState<Device[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCode, setFilterCode] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterBuilding, setFilterBuilding] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterCommissionedDate, setFilterCommissionedDate] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [formOpen, setFormOpen] = useState(false)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/devices', { credentials: 'include' })
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

  const filtered = list.filter((d) => {
    if (filterCode.trim() && !d.code.includes(filterCode.trim())) return false
    if (filterName.trim() && !d.name.includes(filterName.trim())) return false
    if (filterType.trim() && !d.type.includes(filterType.trim())) return false
    if (filterBuilding.trim() && !(d.buildingName ?? '').includes(filterBuilding.trim()))
      return false
    if (filterLocation.trim() && !(d.location ?? '').includes(filterLocation.trim()))
      return false
    if (
      filterCommissionedDate.trim() &&
      !(d.commissionedDate ?? '').includes(filterCommissionedDate.trim())
    )
      return false
    if (filterStatus && d.status !== filterStatus) return false
    return true
  })
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const handleDelete = async (item: Device) => {
    if (!confirm(`确定删除设备「${item.code}」${item.name}？`)) return
    setDeleting(item.id)
    try {
      const res = await fetch(`/api/devices/${item.id}`, {
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

  const handleEdit = (item: Device) => {
    setEditingDevice(item)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingDevice(null)
    fetchData()
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/devices/export', { credentials: 'include' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert((j as { message?: string }).message || '导出失败')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `设备台账导出_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('导出失败')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case '正常':
        return 'text-green-600 dark:text-green-400'
      case '维修中':
        return 'text-amber-600 dark:text-amber-400'
      case '报废':
        return 'text-slate-500'
      default:
        return ''
    }
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理设备台账</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作设备台账管理功能。</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[110px] flex-1 sm:max-w-[160px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">设备编号</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[110px] flex-1 sm:max-w-[160px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">设备名称</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[110px] flex-1 sm:max-w-[160px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">设备类型</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[110px] flex-1 sm:max-w-[160px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">所属楼宇</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterBuilding}
              onChange={(e) => setFilterBuilding(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[110px] flex-1 sm:max-w-[180px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">具体位置</label>
            <input
              type="text"
              placeholder="模糊查询"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[120px] flex-1 sm:max-w-[160px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">投用日期</label>
            <input
              type="text"
              placeholder="如 2024-03"
              value={filterCommissionedDate}
              onChange={(e) => setFilterCommissionedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 min-w-[100px] w-full sm:w-auto sm:min-w-[120px]">
            <label className="text-xs text-slate-500 dark:text-slate-400">状态</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部</option>
              {DEVICE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingDevice(null)
              setFormOpen(true)
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shrink-0 h-[38px] self-end"
          >
            <Plus className="w-4 h-4" />
            新增设备
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shrink-0 h-[38px] self-end"
          >
            <Download className="w-4 h-4" />
            批量导出
          </button>
          <button
            type="button"
            onClick={() => setShowBatchImport(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 shrink-0 h-[38px] self-end"
          >
            <Upload className="w-4 h-4" />
            批量导入
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">设备编号</th>
              <th className="text-left p-4 font-medium">设备名称</th>
              <th className="text-left p-4 font-medium">设备类型</th>
              <th className="text-left p-4 font-medium">所属楼宇</th>
              <th className="text-left p-4 font-medium min-w-[100px] max-w-[200px]">具体位置</th>
              <th className="text-left p-4 font-medium whitespace-nowrap">投用日期</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-slate-500">
                  加载中...
                </td>
              </tr>
            ) : (
              paginatedItems.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="p-4 font-mono text-sm">{d.code}</td>
                  <td className="p-4 font-medium">{d.name}</td>
                  <td className="p-4">{d.type}</td>
                  <td className="p-4">{d.buildingName}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[200px]">
                    <span className="line-clamp-2 break-words" title={d.location ?? undefined}>
                      {d.location?.trim() ? d.location : '—'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {d.commissionedDate ?? '—'}
                  </td>
                  <td className="p-4">
                    <span className={getStatusColor(d.status)}>{d.status}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(d)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        disabled={deleting === d.id}
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
          暂无数据，点击「新增设备」添加
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
        <DeviceForm
          device={editingDevice}
          buildings={buildings}
          onClose={handleFormClose}
        />
      )}
      {showBatchImport && (
        <DeviceBatchImportModal
          buildings={buildings}
          onClose={() => setShowBatchImport(false)}
          onSuccess={() => fetchData()}
        />
      )}
    </div>
  )
}
