'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { rememberWorkOrderReturnPath } from '@/components/work-orders/WorkOrderDetailBackButton'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2, Search, Eye, X } from 'lucide-react'
import {
  DeviceMaintenanceForm,
  type DeviceOption,
  type MaintainerOption,
} from './DeviceMaintenanceForm'
import {
  DeviceMaintenanceImageUpload,
  parseMaintenanceImageUrls,
} from './DeviceMaintenanceImageUpload'

export type MaintenanceListRow = {
  id: number
  code: string
  type: string
  date: string
  maintainerId: number | null
  maintainerName: string
  cost: number
  content: string
  images: string | null
  remark: string | null
  companyId: number
  createdAt: string
  deviceCount: number
  deviceSummary: string
  workOrderCount: number
  items: { deviceCode: string; deviceName: string }[]
}

type ApiData = {
  list: MaintenanceListRow[]
  deviceOptions: DeviceOption[]
  maintainerOptions: MaintainerOption[]
}

type DetailItem = {
  id: number
  deviceId: number | null
  deviceCode: string
  deviceName: string
  deviceType: string | null
  buildingName: string | null
  deviceRemovedFromLedger: boolean
}

type DetailRecord = {
  id: number
  code: string
  type: string
  date: string
  maintainerName: string
  cost: number
  content: string
  images: string | null
  remark: string | null
  createdAt: string
  items: DetailItem[]
  linkedWorkOrders: { id: number; code: string; title: string; status: string; type: string }[]
}

function DetailField({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed">{children}</div>
    </div>
  )
}

export function DeviceMaintenanceList() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [keywordInput, setKeywordInput] = useState('')
  const [maintainerInput, setMaintainerInput] = useState('')
  const [deviceInput, setDeviceInput] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [debouncedMaintainer, setDebouncedMaintainer] = useState('')
  const [debouncedDevice, setDebouncedDevice] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailSheetIn, setDetailSheetIn] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRecord, setDetailRecord] = useState<DetailRecord | null>(null)

  const closeDetailDrawer = useCallback(() => {
    setDetailSheetIn(false)
    window.setTimeout(() => {
      setDetailOpen(false)
      setDetailRecord(null)
    }, 280)
  }, [])

  useEffect(() => {
    if (!detailOpen) {
      setDetailSheetIn(false)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDetailSheetIn(true))
    })
    return () => cancelAnimationFrame(id)
  }, [detailOpen])

  useEffect(() => {
    if (!detailOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [detailOpen])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim())
      setDebouncedMaintainer(maintainerInput.trim())
      setDebouncedDevice(deviceInput.trim())
    }, 400)
    return () => window.clearTimeout(t)
  }, [keywordInput, maintainerInput, deviceInput])

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams()
    if (typeFilter.trim()) q.set('type', typeFilter.trim())
    if (dateFrom) q.set('dateFrom', dateFrom)
    if (dateTo) q.set('dateTo', dateTo)
    if (debouncedKeyword) q.set('keyword', debouncedKeyword)
    if (debouncedMaintainer) q.set('maintainer', debouncedMaintainer)
    if (debouncedDevice) q.set('device', debouncedDevice)
    const s = q.toString()
    return s ? `?${s}` : ''
  }, [typeFilter, dateFrom, dateTo, debouncedKeyword, debouncedMaintainer, debouncedDevice])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/device-maintenance-records${buildQuery()}`)
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '加载失败')
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该维保记录吗？删除后不可恢复。')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/device-maintenance-records/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchData()
      } else {
        alert(json.message || '删除失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingId(null)
    fetchData()
  }

  const openDetail = useCallback(async (id: number) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailRecord(null)
    try {
      const res = await fetch(`/api/device-maintenance-records/${id}`)
      const json = await res.json()
      if (json.success) {
        setDetailRecord(json.data)
      } else {
        alert(json.message || '加载详情失败')
        setDetailOpen(false)
      }
    } catch {
      alert('网络错误')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const idStr = searchParams.get('detail')
    if (!idStr) return
    const id = parseInt(idStr, 10)
    if (Number.isNaN(id)) return
    void openDetail(id)
    router.replace('/device-maintenance-records', { scroll: false })
  }, [searchParams, router, openDetail])

  const list = data?.list ?? []

  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(list, 15)

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
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[160px] max-w-[280px]">
          <label className="text-xs text-slate-500 block mb-1">关键词</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="单号、类型、内容（留空查全部）"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
        </div>
        <div className="w-[140px] min-w-[120px]">
          <label className="text-xs text-slate-500 block mb-1">维保人员</label>
          <input
            type="text"
            value={maintainerInput}
            onChange={(e) => setMaintainerInput(e.target.value)}
            placeholder="模糊匹配"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[160px] max-w-[280px]">
          <label className="text-xs text-slate-500 block mb-1">设备</label>
          <input
            type="text"
            value={deviceInput}
            onChange={(e) => setDeviceInput(e.target.value)}
            placeholder="编号或名称模糊匹配"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div className="w-[140px] min-w-[120px]">
          <label className="text-xs text-slate-500 block mb-1">维保类型</label>
          <input
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="模糊匹配"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div className="w-full sm:w-auto min-w-[min(100%,320px)] max-w-md">
          <label className="text-xs text-slate-500 block mb-1">维保日期</label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 min-w-[130px] px-1 py-1 text-sm bg-transparent border-0 focus:ring-0 dark:[color-scheme:dark]"
              aria-label="开始日期"
            />
            <span className="text-slate-400 text-sm shrink-0">至</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 min-w-[130px] px-1 py-1 text-sm bg-transparent border-0 focus:ring-0 dark:[color-scheme:dark]"
              aria-label="结束日期"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchData()}
          className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          刷新
        </button>
        <button
          onClick={() => {
            setEditingId(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增维保记录
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">单号</th>
              <th className="text-left p-4 font-medium">类型</th>
              <th className="text-left p-4 font-medium">日期</th>
              <th className="text-left p-4 font-medium">人员</th>
              <th className="text-left p-4 font-medium">费用</th>
              <th className="text-left p-4 font-medium">设备</th>
              <th className="text-left p-4 font-medium w-[72px]">工单</th>
              <th className="text-left p-4 font-medium w-[220px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-mono text-sm">{r.code}</td>
                <td className="p-4">{r.type}</td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{r.date}</td>
                <td className="p-4 text-sm">{r.maintainerName}</td>
                <td className="p-4 text-sm">{r.cost.toFixed(2)}</td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-400 max-w-[240px]">
                  <span className="line-clamp-2" title={r.deviceSummary}>
                    {r.deviceSummary}
                  </span>
                </td>
                <td className="p-4 text-sm text-center text-slate-600 dark:text-slate-400">
                  {r.workOrderCount ?? 0}
                </td>
                <td className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openDetail(r.id)}
                      className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded text-xs inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      详情
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id)
                        setFormOpen(true)
                      }}
                      className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded text-xs inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="px-2.5 py-1.5 text-red-600 border border-red-200 hover:bg-red-50 rounded text-xs inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div className="p-12 text-center text-slate-500">暂无数据，点击「新增维保记录」添加</div>
      )}
      {list.length > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
      {formOpen && data && (
        <DeviceMaintenanceForm
          recordId={editingId}
          deviceOptions={data.deviceOptions}
          maintainerOptions={data.maintainerOptions}
          onClose={handleFormClose}
        />
      )}
      {detailOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" aria-hidden={!detailOpen}>
          <button
            type="button"
            aria-label="关闭抽屉"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
            onClick={closeDetailDrawer}
          />
          <aside
            id="maintenance-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="maintenance-detail-title"
            className={`relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-800 dark:shadow-black/40 border-l border-slate-200 dark:border-slate-600 transition-transform duration-300 ease-out ${
              detailSheetIn ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 px-5 py-4 bg-slate-50/90 dark:bg-slate-900/50">
              <div>
                <h2 id="maintenance-detail-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  维保详情
                </h2>
                {!detailLoading && detailRecord && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                    {detailRecord.code}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeDetailDrawer}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
              {detailLoading && (
                <div className="text-slate-500 text-center py-16 text-sm">加载中…</div>
              )}
              {!detailLoading && detailRecord && (
                <div className="space-y-8 max-w-none">
                  <section className="space-y-4">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      基本信息
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <DetailField label="维保单号">
                        <span className="font-mono text-[13px]">{detailRecord.code}</span>
                      </DetailField>
                      <DetailField label="维保类型">{detailRecord.type}</DetailField>
                      <DetailField label="维保日期">{detailRecord.date}</DetailField>
                      <DetailField label="维保人员">{detailRecord.maintainerName}</DetailField>
                      <DetailField label="费用（元）" className="sm:col-span-2">
                        <span className="text-base font-medium tabular-nums">
                          {detailRecord.cost.toFixed(2)}
                        </span>
                      </DetailField>
                    </div>
                  </section>

                  <section>
                    <DetailField label="维保内容">
                      <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-3 border border-slate-100 dark:border-slate-700">
                        {detailRecord.content}
                      </p>
                    </DetailField>
                  </section>

                  {(() => {
                    const detailImages = parseMaintenanceImageUrls(detailRecord.images)
                    if (detailImages.length === 0) return null
                    return (
                      <section>
                        <DetailField label="维保图片">
                          <DeviceMaintenanceImageUpload
                            urls={detailImages}
                            onChange={() => {}}
                            disabled
                          />
                        </DetailField>
                      </section>
                    )
                  })()}

                  {detailRecord.remark ? (
                    <section>
                      <DetailField label="备注">
                        <p className="whitespace-pre-wrap">{detailRecord.remark}</p>
                      </DetailField>
                    </section>
                  ) : null}

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      关联工单
                    </h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-600">
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                工单号
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 min-w-[120px]">
                                标题
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                状态
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                类型
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap w-[72px]">
                                操作
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {detailRecord.linkedWorkOrders && detailRecord.linkedWorkOrders.length > 0 ? (
                              detailRecord.linkedWorkOrders.map((w) => (
                                <tr
                                  key={w.id}
                                  className="bg-white dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                                >
                                  <td className="px-3 py-2.5 font-mono text-xs text-blue-600 dark:text-blue-400">
                                    {w.code}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-800 dark:text-slate-100 max-w-[200px]">
                                    <span className="line-clamp-2" title={w.title}>
                                      {w.title}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {w.status}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    {w.type}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        rememberWorkOrderReturnPath(
                                          `/device-maintenance-records?detail=${detailRecord.id}`
                                        )
                                        router.push(`/work-orders/${w.id}`)
                                      }}
                                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium"
                                    >
                                      查看
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                                >
                                  暂无关联工单
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      维保设备
                    </h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-600">
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                设备编号
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 min-w-[100px]">
                                设备名称
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                类型
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                楼宇
                              </th>
                              <th className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300 min-w-[100px]">
                                说明
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {detailRecord.items.length > 0 ? (
                              detailRecord.items.map((i) => (
                                <tr
                                  key={i.id}
                                  className="bg-white dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                                >
                                  <td className="px-3 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-100">
                                    {i.deviceCode}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-800 dark:text-slate-100">
                                    {i.deviceName}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                                    {i.deviceType ?? '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                                    {i.buildingName ?? '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-xs">
                                    {i.deviceRemovedFromLedger ? (
                                      <span className="text-amber-700 dark:text-amber-400">
                                        台账已删除，快照保留
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                                >
                                  暂无设备明细
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>

                  <DetailField label="创建时间">
                    <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                      {new Date(detailRecord.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </DetailField>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
