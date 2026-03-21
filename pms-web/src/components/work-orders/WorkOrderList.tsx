'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLink } from '@/components/AppLink'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Eye, UserPlus, Search, RotateCcw, Users } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { displayWorkOrderSource } from '@/lib/work-order'
import { EmployeeAssigneeSelect } from '@/components/work-orders/EmployeeAssigneeSelect'

const EMPTY_FILTERS = {
  createdFrom: '',
  createdTo: '',
  type: '',
  source: '',
  tenantQ: '',
  assigneeQ: '',
} as const

type FilterState = {
  createdFrom: string
  createdTo: string
  type: string
  source: string
  tenantQ: string
  assigneeQ: string
}

type WorkOrder = {
  id: number
  code: string
  title: string
  type: string
  source?: string
  facilityScope?: string | null
  building: { id: number; name: string } | null
  room: { id: number; name: string; roomNumber: string } | null
  tenant: { id: number; companyName: string } | null
  status: string
  assignedTo: number | null
  assignedEmployee: { id: number; name: string } | null
  createdAt: string
}

type ApiData = {
  list: WorkOrder[]
  buildings: { id: number; name: string }[]
  employees: { id: number; name: string; phone: string }[]
  workOrderTypes: { id: number; name: string }[]
  sourceOptions: string[]
  statusOptions: string[]
}

export function WorkOrderList() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('')
  const [draftFilters, setDraftFilters] = useState<FilterState>({ ...EMPTY_FILTERS })
  const [queryFilters, setQueryFilters] = useState<FilterState>({ ...EMPTY_FILTERS })
  const [assignModal, setAssignModal] = useState<WorkOrder | null>(null)
  const [assigningTo, setAssigningTo] = useState<number | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchAssignTo, setBatchAssignTo] = useState<number | null>(null)
  const [batchAssigning, setBatchAssigning] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusTab) params.set('status', statusTab)
      if (queryFilters.createdFrom) params.set('createdFrom', queryFilters.createdFrom)
      if (queryFilters.createdTo) params.set('createdTo', queryFilters.createdTo)
      if (queryFilters.type) params.set('type', queryFilters.type)
      if (queryFilters.source) params.set('source', queryFilters.source)
      if (queryFilters.tenantQ.trim()) params.set('tenantQ', queryFilters.tenantQ.trim())
      if (queryFilters.assigneeQ.trim()) params.set('assigneeQ', queryFilters.assigneeQ.trim())
      const res = await fetch(`/api/work-orders?${params}`, { credentials: 'include' })
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
  }, [statusTab, queryFilters])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [statusTab, queryFilters])

  const handleAssign = async () => {
    if (!assignModal || !assigningTo) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/work-orders/${assignModal.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedTo: assigningTo }),
      })
      const json = await res.json()
      if (json.success) {
        setAssignModal(null)
        setAssigningTo(null)
        loadData()
      } else {
        alert(json.message || '派单失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setAssigning(false)
    }
  }

  const list = data?.list ?? []
  const employees = data?.employees ?? []
  const statusOptions = data?.statusOptions ?? []
  const workOrderTypes = data?.workOrderTypes ?? []
  const sourceOptions = data?.sourceOptions ?? []
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange, setPage } =
    usePagination(list, 15)

  useEffect(() => {
    setPage(1)
  }, [statusTab, queryFilters, setPage])

  const hasActiveQuery = Object.values(queryFilters).some((v) => String(v).trim() !== '')

  const handleApplyFilters = () => {
    setQueryFilters({ ...draftFilters })
  }

  const handleResetFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS })
    setQueryFilters({ ...EMPTY_FILTERS })
  }

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPage = () => {
    const ids = paginatedItems.map((w) => w.id)
    const allOn = ids.length > 0 && ids.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOn) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  const openBatchAssign = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const rows = list.filter((w) => ids.includes(w.id))
    const bad = rows.filter((w) => !['待派单', '待响应'].includes(w.status))
    if (bad.length > 0) {
      alert('这些状态的不能再派单了')
      return
    }
    setBatchAssignTo(null)
    setBatchModalOpen(true)
  }

  const handleBatchAssign = async () => {
    if (!batchAssignTo || selectedIds.size === 0) return
    setBatchAssigning(true)
    try {
      const res = await fetch('/api/work-orders/batch-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          assignedTo: batchAssignTo,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setBatchModalOpen(false)
        setSelectedIds(new Set())
        await loadData()
      } else {
        alert(json.message || '批量派单失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setBatchAssigning(false)
    }
  }

  const pageIds = paginatedItems.map((w) => w.id)
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">按状态查看</p>
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-600 overflow-x-auto pb-px -mb-px">
              <button
                type="button"
                onClick={() => setStatusTab('')}
                className={`shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-colors ${
                  statusTab === ''
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/80 dark:bg-slate-700/40'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                全部
              </button>
              {statusOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusTab(s)}
                  className={`shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-colors ${
                    statusTab === s
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/80 dark:bg-slate-700/40'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 sm:self-center">
            <button
              type="button"
              onClick={openBatchAssign}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Users className="w-4 h-4" />
              批量派单
              {selectedIds.size > 0 ? `（${selectedIds.size}）` : ''}
            </button>
            <AppLink
              href="/work-orders/new"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              新建工单
            </AppLink>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">筛选条件（填写后点击「查询」）</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-end">
            <div className="sm:col-span-2">
              <span className={labelCls}>创建时间</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={draftFilters.createdFrom}
                  onChange={(e) =>
                    setDraftFilters((p) => ({ ...p, createdFrom: e.target.value }))
                  }
                  className={`${inputCls} min-w-[140px] flex-1`}
                />
                <span className="text-slate-400 text-sm shrink-0">至</span>
                <input
                  type="date"
                  value={draftFilters.createdTo}
                  onChange={(e) =>
                    setDraftFilters((p) => ({ ...p, createdTo: e.target.value }))
                  }
                  className={`${inputCls} min-w-[140px] flex-1`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>类型</label>
              <select
                value={draftFilters.type}
                onChange={(e) => setDraftFilters((p) => ({ ...p, type: e.target.value }))}
                className={inputCls}
              >
                <option value="">全部类型</option>
                {workOrderTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>来源</label>
              <select
                value={draftFilters.source}
                onChange={(e) => setDraftFilters((p) => ({ ...p, source: e.target.value }))}
                className={inputCls}
              >
                <option value="">全部来源</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>租客（模糊）</label>
              <input
                type="text"
                value={draftFilters.tenantQ}
                onChange={(e) => setDraftFilters((p) => ({ ...p, tenantQ: e.target.value }))}
                placeholder="公司名称关键词"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>处理人（模糊）</label>
              <input
                type="text"
                value={draftFilters.assigneeQ}
                onChange={(e) => setDraftFilters((p) => ({ ...p, assigneeQ: e.target.value }))}
                placeholder="员工姓名关键词"
                className={inputCls}
              />
            </div>
            <div className="flex flex-wrap gap-2 xl:col-span-6">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                <Search className="w-4 h-4" />
                查询
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <th className="p-4 w-12">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                    disabled={loading || paginatedItems.length === 0}
                    className="rounded border-slate-300"
                    title="全选本页"
                  />
                </th>
                <th className="text-left p-4 font-medium">工单编号</th>
                <th className="text-left p-4 font-medium">标题</th>
                <th className="text-left p-4 font-medium">类型</th>
                <th className="text-left p-4 font-medium">来源</th>
                <th className="text-left p-4 font-medium">设施范围</th>
                <th className="text-left p-4 font-medium">楼宇</th>
                <th className="text-left p-4 font-medium">房源</th>
                <th className="text-left p-4 font-medium">租客</th>
                <th className="text-left p-4 font-medium">状态</th>
                <th className="text-left p-4 font-medium">处理人</th>
                <th className="text-left p-4 font-medium">创建时间</th>
                <th className="text-left p-4 font-medium w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : (
                paginatedItems.map((wo) => (
                  <tr
                    key={wo.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(wo.id)}
                        onChange={() => toggleSelectId(wo.id)}
                        className="rounded border-slate-300"
                        aria-label={`选择 ${wo.code}`}
                      />
                    </td>
                    <td className="p-4">
                      <AppLink
                        href={`/work-orders/${wo.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {wo.code}
                      </AppLink>
                    </td>
                    <td className="p-4">{wo.title}</td>
                    <td className="p-4">{wo.type}</td>
                    <td className="p-4 text-sm">{displayWorkOrderSource(wo.source)}</td>
                    <td className="p-4 text-sm">{wo.facilityScope ?? '-'}</td>
                    <td className="p-4">{wo.building?.name ?? '-'}</td>
                    <td className="p-4">{wo.room?.roomNumber ?? '-'}</td>
                    <td className="p-4">{wo.tenant?.companyName ?? '-'}</td>
                    <td className="p-4">{wo.status}</td>
                    <td className="p-4">{wo.assignedEmployee?.name ?? '-'}</td>
                    <td className="p-4">{formatDateTime(wo.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <AppLink
                          href={`/work-orders/${wo.id}`}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </AppLink>
                        {['待派单', '待响应'].includes(wo.status) && (
                          <button
                            onClick={() => {
                              setAssignModal(wo)
                              setAssigningTo(null)
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                            title={wo.status === '待派单' ? '派单' : '改派'}
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
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
            {hasActiveQuery
              ? '没有符合当前筛选条件的工单，可尝试放宽条件或点击「重置」'
              : statusTab
                ? `当前状态下暂无工单（${statusTab}）`
                : '暂无工单，点击「新建工单」添加'}
          </div>
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

      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {assignModal.status === '待派单' ? '派单' : '改派'} - {assignModal.code}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{assignModal.title}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">选择处理人</label>
              <EmployeeAssigneeSelect
                employees={employees}
                value={assigningTo}
                onChange={setAssigningTo}
                disabled={assigning}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAssignModal(null)
                  setAssigningTo(null)
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleAssign}
                disabled={!assigningTo || assigning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {assigning ? '提交中...' : assignModal.status === '待派单' ? '确认派单' : '确认改派'}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">批量派单</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              已选 {selectedIds.size} 条工单（仅「待派单」「待响应」）。待派单将派单并进入待响应；待响应将改派处理人。
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">选择处理人</label>
              <EmployeeAssigneeSelect
                employees={employees}
                value={batchAssignTo}
                onChange={setBatchAssignTo}
                disabled={batchAssigning}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleBatchAssign()}
                disabled={!batchAssignTo || batchAssigning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {batchAssigning ? '提交中…' : '确认批量派单'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
