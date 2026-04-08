'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { PopoverDateRangeField } from '@/components/ui/PopoverDateRangeField'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

type InspectionTask = {
  id: number
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  personnelNames: string
  buildingName: string | null
}

type LinkedDeviceRow = {
  id: number
  code: string
  name: string
  type: string
  location: string
  status: string
}

type CheckItemRow = {
  name: string
  nfcTagId: number
  tagId: string
  location: string
  linkedDevices?: LinkedDeviceRow[]
  /** 巡检点台账参考图 URL，列表最多展示前 2 张，预览可滑动全部 */
  pointImages?: string[]
}

type RecordRow = {
  id: number
  tagId: string
  location: string
  checkedAt: string
  checkedByName: string
  status: string
  detail: string | null
}

type AssignedStaffRow = { id: number; name: string; active: boolean }

type TaskDetail = {
  id: number
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  buildingName: string | null
  personnelNames?: string
  userIds?: number[]
  assignedStaff?: AssignedStaffRow[]
  checkItems: CheckItemRow[]
  progress: { total: number; done: number }
  records: RecordRow[]
}

type Building = { id: number; name: string }

type ActivePlanOption = {
  id: number
  name: string
  inspectionType: string
  buildingName: string
  autoGenerateTasks?: boolean
}

type AssignEmployee = { id: number; name: string }

type ApiListData = {
  list: InspectionTask[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  buildings: Building[]
  employees: AssignEmployee[]
  statusOptions: string[]
  activePlans: ActivePlanOption[]
}

/** 与巡检计划大类一致：工程 / 安保 / 设备 / 绿化 */
const INSPECTION_TYPE_TABS: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: '工程', label: '工程巡检' },
  { key: '安保', label: '安保巡检' },
  { key: '设备', label: '设备巡检' },
  { key: '绿化', label: '绿化巡检' },
]

function taskMatchesInspectionCategory(inspectionType: string, categoryKey: string): boolean {
  if (!categoryKey) return true
  const raw = (inspectionType ?? '').trim()
  if (!raw) return false
  if (raw === categoryKey) return true
  if (raw === `${categoryKey}巡检`) return true
  if (raw.startsWith(categoryKey)) return true
  return false
}

export function InspectionTaskList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<ApiListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateDrawerOpen, setGenerateDrawerOpen] = useState(false)
  const [genDrawerDate, setGenDrawerDate] = useState('')
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(() => new Set())
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  /** 设备巡检：关联设备默认展开；在此 Set 中的下标表示已收起 */
  const [collapsedCheckDeviceRows, setCollapsedCheckDeviceRows] = useState<Set<number>>(
    () => new Set()
  )
  const [pointImageGallery, setPointImageGallery] = useState<{
    urls: string[]
    index: number
  } | null>(null)
  /** 任务列表按巡检大类 Tab：'' 表示全部 */
  const [typeTabKey, setTypeTabKey] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [personnelEditing, setPersonnelEditing] = useState(false)
  const [personnelDraftIds, setPersonnelDraftIds] = useState<number[]>([])
  const [personnelSaving, setPersonnelSaving] = useState(false)
  /** 按周期生成抽屉内计划列表：单独请求巡检计划接口，避免与任务列表接口失败/缓存等问题耦合 */
  const [drawerPlans, setDrawerPlans] = useState<ActivePlanOption[]>([])
  const [drawerPlansLoading, setDrawerPlansLoading] = useState(false)
  /** 当前列表（含分类 Tab）多选，切换 Tab 会清空以免误操作不可见行 */
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<number>>(() => new Set())
  const [batchAssignOpen, setBatchAssignOpen] = useState(false)
  const [batchUserDraftIds, setBatchUserDraftIds] = useState<number[]>([])
  const [batchAssignSaving, setBatchAssignSaving] = useState(false)
  const batchSelectAllRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [jumpPageInput, setJumpPageInput] = useState('')

  useEffect(() => {
    const tid = searchParams.get('taskId')
    if (tid == null || tid === '') {
      setSelectedId(null)
      return
    }
    const n = parseInt(tid, 10)
    if (!Number.isInteger(n) || n < 1) {
      setSelectedId(null)
      return
    }
    setSelectedId(n)
  }, [searchParams])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (buildingFilter) params.set('buildingId', buildingFilter)
      if (typeTabKey) params.set('category', typeTabKey)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const res = await fetch(`/api/inspection-tasks?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        const total = typeof d.total === 'number' ? d.total : d.list?.length ?? 0
        const ps = typeof d.pageSize === 'number' ? d.pageSize : pageSize
        const totalPages = Math.max(1, typeof d.totalPages === 'number' ? d.totalPages : Math.ceil(total / ps) || 1)
        const pg = typeof d.page === 'number' ? d.page : page
        setData({
          list: d.list ?? [],
          total,
          page: pg,
          pageSize: ps,
          totalPages,
          buildings: d.buildings ?? [],
          employees: d.employees ?? [],
          statusOptions: d.statusOptions ?? ['待执行', '巡检中', '已完成', '已逾期'],
          activePlans: d.activePlans ?? [],
        })
        if (pg !== page) {
          setPage(pg)
        }
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [
    statusFilter,
    dateFrom,
    dateTo,
    buildingFilter,
    typeTabKey,
    page,
    pageSize,
  ])

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/inspection-tasks/${id}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        const nextStatus = typeof d.status === 'string' ? d.status : ''
        setDetail({
          ...d,
          userIds: Array.isArray(d.userIds) ? d.userIds : [],
          assignedStaff: Array.isArray(d.assignedStaff) ? d.assignedStaff : [],
          personnelNames: d.personnelNames ?? '-',
          records: d.records ?? [],
          checkItems: Array.isArray(d.checkItems)
            ? d.checkItems.map(
                (row: CheckItemRow & { linkedDevices?: LinkedDeviceRow[]; pointImages?: string[] }) => ({
                  ...row,
                  linkedDevices: Array.isArray(row.linkedDevices) ? row.linkedDevices : [],
                  pointImages: Array.isArray(row.pointImages) ? row.pointImages : [],
                })
              )
            : [],
        })
        if (nextStatus) {
          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              list: prev.list.map((row) =>
                row.id === id ? { ...row, status: nextStatus } : row
              ),
            }
          })
        }
      } else {
        setDetail(null)
      }
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const recordDoneTagIds = useMemo(() => {
    if (!detail?.records?.length) return new Set<string>()
    return new Set(detail.records.map((r) => r.tagId).filter(Boolean))
  }, [detail])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!loading && data && data.list.length === 0 && data.total > 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1))
    }
  }, [loading, data, page])

  useEffect(() => {
    setJumpPageInput(String(page))
  }, [page])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  useEffect(() => {
    setPersonnelEditing(false)
    setPersonnelDraftIds([])
    setCollapsedCheckDeviceRows(new Set())
    setPointImageGallery(null)
  }, [selectedId])

  useEffect(() => {
    if (!generateDrawerOpen) {
      setDrawerPlans([])
      setDrawerPlansLoading(false)
    }
  }, [generateDrawerOpen])

  useEffect(() => {
    if (!pointImageGallery) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPointImageGallery(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        setPointImageGallery((g) => {
          if (!g || g.urls.length === 0) return g
          return {
            urls: g.urls,
            index: (g.index - 1 + g.urls.length) % g.urls.length,
          }
        })
      }
      if (e.key === 'ArrowRight') {
        setPointImageGallery((g) => {
          if (!g || g.urls.length === 0) return g
          return {
            urls: g.urls,
            index: (g.index + 1) % g.urls.length,
          }
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pointImageGallery])

  const openGenerateDrawer = () => {
    setGenDrawerDate('')
    setGenerateDrawerOpen(true)
    setDrawerPlans([])
    setDrawerPlansLoading(true)
    setSelectedPlanIds(new Set())
    void (async () => {
      try {
        const res = await fetch('/api/inspection-plans', { credentials: 'include' })
        const json = await res.json()
        if (!json.success || !json.data?.list) {
          setDrawerPlans([])
          return
        }
        const blist = json.data.buildings as { id: number; name: string }[]
        const buildingName = (bid: number | null | undefined) =>
          !bid ? '—' : blist.find((b) => b.id === bid)?.name ?? '—'
        type PlanRow = {
          id: number
          name: string
          inspectionType: string
          buildingId?: number | null
          status: string
          autoGenerateTasks?: boolean
        }
        const actives = (json.data.list as PlanRow[]).filter(
          (p) => p.status === 'active' || p.status === '启用'
        )
        const mapped: ActivePlanOption[] = actives.map((p) => ({
          id: p.id,
          name: p.name,
          inspectionType: p.inspectionType,
          buildingName: buildingName(p.buildingId),
          autoGenerateTasks: p.autoGenerateTasks,
        }))
        setDrawerPlans(mapped)
        setSelectedPlanIds(new Set(mapped.map((p) => p.id)))
      } catch {
        setDrawerPlans([])
      } finally {
        setDrawerPlansLoading(false)
      }
    })()
  }

  const togglePlanId = (id: number) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllPlans = () => {
    setSelectedPlanIds(new Set(drawerPlans.map((p) => p.id)))
  }

  const clearAllPlans = () => setSelectedPlanIds(new Set())

  const handleConfirmGenerate = async () => {
    if (selectedPlanIds.size < 1) {
      alert('请至少选择一个巡检计划')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/inspection-tasks/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: genDrawerDate.trim() || undefined,
          planIds: Array.from(selectedPlanIds),
        }),
      })
      const json = await res.json()
      if (json.success) {
        const n = json.data?.taskCount ?? json.data?.created ?? 0
        const runDay =
          (typeof json.data?.runDateYmd === 'string' && json.data.runDateYmd) ||
          json.data?.runDate?.slice(0, 10) ||
          ''
        const hints = json.data?.zeroTaskHints as string[] | undefined
        setGenerateDrawerOpen(false)
        loadData()
        if (n === 0 && hints && hints.length > 0) {
          alert(
            `未生成新任务（运行日 ${runDay}，北京时间）。\n\n原因说明：\n${hints.map((h) => `• ${h}`).join('\n')}`
          )
        } else {
          alert(`已生成 ${n} 个任务（运行日 ${runDay || '今天'}，北京时间）`)
        }
      } else {
        alert(json.message || '生成失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (!generateDrawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [generateDrawerOpen])

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  useEffect(() => {
    setBatchSelectedIds(new Set())
  }, [statusFilter, dateFrom, dateTo, buildingFilter, typeTabKey])

  useEffect(() => {
    if (!batchAssignOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !batchAssignSaving) setBatchAssignOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [batchAssignOpen, batchAssignSaving])

  const visibleTaskIds = list.map((t) => t.id)
  const allVisibleBatchSelected =
    visibleTaskIds.length > 0 && visibleTaskIds.every((id) => batchSelectedIds.has(id))
  const someVisibleBatchSelected = visibleTaskIds.some((id) => batchSelectedIds.has(id))

  useEffect(() => {
    const el = batchSelectAllRef.current
    if (!el) return
    el.indeterminate = someVisibleBatchSelected && !allVisibleBatchSelected
  }, [someVisibleBatchSelected, allVisibleBatchSelected])

  const statusOptions = data?.statusOptions ?? ['待执行', '巡检中', '已完成', '已逾期']
  const buildings = data?.buildings ?? []
  const employees = data?.employees ?? []
  const hasApiFilters = Boolean(statusFilter || dateFrom || dateTo || buildingFilter)

  const applyJumpToPage = () => {
    const n = parseInt(jumpPageInput.trim(), 10)
    if (!Number.isInteger(n) || n < 1 || n > totalPages) {
      alert(`请输入 1～${totalPages} 之间的页码`)
      return
    }
    setPage(n)
  }

  const handleDeleteTask = async (taskId: number, e?: MouseEvent) => {
    e?.stopPropagation()
    if (
      !confirm(
        '确定删除该巡检任务？关联的本任务巡检打点记录将一并删除，且不可恢复。'
      )
    )
      return
    setDeletingId(taskId)
    try {
      const res = await fetch(`/api/inspection-tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) {
        alert(json.message ?? '删除失败')
        return
      }
      if (selectedId === taskId) {
        setSelectedId(null)
        setDetail(null)
        router.replace('/inspection-tasks', { scroll: false })
      }
      await loadData()
    } catch {
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const startPersonnelEdit = () => {
    if (!detail) return
    setPersonnelDraftIds([...(detail.userIds ?? [])])
    setPersonnelEditing(true)
  }

  const cancelPersonnelEdit = () => {
    setPersonnelEditing(false)
    setPersonnelDraftIds([])
  }

  const togglePersonnelDraft = (empId: number) => {
    setPersonnelDraftIds((prev) =>
      prev.includes(empId) ? prev.filter((x) => x !== empId) : [...prev, empId]
    )
  }

  const savePersonnel = async () => {
    if (!selectedId) return
    setPersonnelSaving(true)
    try {
      const res = await fetch(`/api/inspection-tasks/${selectedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: personnelDraftIds }),
      })
      const json = await res.json()
      if (!json.success) {
        alert(json.message ?? '保存失败')
        return
      }
      setPersonnelEditing(false)
      await loadDetail(selectedId)
      await loadData()
    } catch {
      alert('保存失败')
    } finally {
      setPersonnelSaving(false)
    }
  }

  const toggleBatchTaskId = (taskId: number) => {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const toggleSelectAllVisibleBatch = () => {
    setBatchSelectedIds((prev) => {
      const ids = list.map((t) => t.id)
      const allIn = ids.length > 0 && ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allIn) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  const openBatchAssignModal = () => {
    if (batchSelectedIds.size === 0) return
    setBatchUserDraftIds([])
    setBatchAssignOpen(true)
  }

  const toggleBatchUserDraft = (empId: number) => {
    setBatchUserDraftIds((prev) =>
      prev.includes(empId) ? prev.filter((x) => x !== empId) : [...prev, empId]
    )
  }

  const saveBatchAssign = async () => {
    if (batchSelectedIds.size === 0) return
    const taskIds = [...batchSelectedIds]
    const reloadDetailId = selectedId != null && taskIds.includes(selectedId) ? selectedId : null
    setBatchAssignSaving(true)
    try {
      const res = await fetch('/api/inspection-tasks/batch-assign', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, userIds: batchUserDraftIds }),
      })
      const json = await res.json()
      if (!json.success) {
        alert(json.message ?? '批量指派失败')
        return
      }
      setBatchAssignOpen(false)
      setBatchSelectedIds(new Set())
      await loadData()
      if (reloadDetailId != null) await loadDetail(reloadDetailId)
    } catch {
      alert('批量指派失败')
    } finally {
      setBatchAssignSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case '待执行':
        return 'text-slate-600 dark:text-slate-400'
      case '巡检中':
      case '执行中':
        return 'text-blue-600 dark:text-blue-400'
      case '已完成':
        return 'text-green-600 dark:text-green-400'
      case '已逾期':
        return 'text-red-600 dark:text-red-400'
      default:
        return ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">状态</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(e.target.value)
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">全部状态</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">楼宇</label>
          <select
            value={buildingFilter}
            onChange={(e) => {
              setPage(1)
              setBuildingFilter(e.target.value)
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">全部楼宇</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <PopoverDateRangeField
          label="计划日期"
          start={dateFrom}
          end={dateTo}
          onChange={({ start, end }) => {
            setPage(1)
            setDateFrom(start)
            setDateTo(end)
          }}
          className="min-w-[260px] sm:min-w-[320px] max-w-md"
        />
        <button
          type="button"
          onClick={openGenerateDrawer}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
        >
          按周期生成任务
        </button>
        <button
          type="button"
          onClick={openBatchAssignModal}
          disabled={loading || batchSelectedIds.size === 0}
          title={batchSelectedIds.size === 0 ? '请先在列表中勾选任务' : undefined}
          className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
        >
          批量指派{batchSelectedIds.size > 0 ? `（${batchSelectedIds.size}）` : ''}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[480px]">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30">
            <div className="flex gap-0.5 sm:gap-1 overflow-x-auto px-2 pt-2 pb-0 scrollbar-thin">
              {INSPECTION_TYPE_TABS.map((tab) => (
                <button
                  key={tab.key || 'all'}
                  type="button"
                  onClick={() => {
                    setPage(1)
                    setTypeTabKey(tab.key)
                  }}
                  className={`shrink-0 px-3 py-2.5 text-sm whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-colors ${
                    typeTabKey === tab.key
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold bg-white dark:bg-slate-800 shadow-sm'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="w-10 p-2 text-center font-medium">
                    <input
                      ref={batchSelectAllRef}
                      type="checkbox"
                      checked={allVisibleBatchSelected}
                      onChange={toggleSelectAllVisibleBatch}
                      disabled={loading || visibleTaskIds.length === 0}
                      className="rounded border-slate-300"
                      title="全选当前列表"
                      aria-label="全选当前列表"
                    />
                  </th>
                  <th className="text-left p-2 font-medium">编号</th>
                  <th className="text-left p-2 font-medium">计划</th>
                  <th className="text-left p-2 font-medium">计划日</th>
                  <th className="text-left p-2 font-medium">状态</th>
                  <th className="text-right p-2 font-medium w-14">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : (
                  list.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() =>
                        router.replace(`/inspection-tasks?taskId=${t.id}`, { scroll: false })
                      }
                      className={`border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${
                        selectedId === t.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td
                        className="p-2 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={batchSelectedIds.has(t.id)}
                          onChange={() => toggleBatchTaskId(t.id)}
                          className="rounded border-slate-300"
                          aria-label={`选择任务 ${t.code}`}
                        />
                      </td>
                      <td className="p-2 font-mono text-xs">{t.code}</td>
                      <td className="p-2">{t.planName}</td>
                      <td className="p-2 whitespace-nowrap">{formatDate(t.scheduledDate)}</td>
                      <td className="p-2">
                        <span className={getStatusColor(t.status)}>{t.status}</span>
                      </td>
                      <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title="删除任务"
                          disabled={deletingId === t.id}
                          onClick={(e) => void handleDeleteTask(t.id, e)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
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
              <div className="p-8 text-center text-slate-500 text-sm space-y-2 max-w-md mx-auto">
                <p>{hasApiFilters ? '当前筛选条件下暂无巡检任务。' : '暂无任务'}</p>
                {hasApiFilters && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                    若刚按周期生成过，任务可能不在当前「计划日期」范围内；或「楼宇 / 状态」与任务不匹配。请尝试清空上方筛选后再查看。
                  </p>
                )}
              </div>
            )}
          </div>
          {data && (
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/40">
              <span className="whitespace-nowrap">
                共 <strong className="text-slate-800 dark:text-slate-200">{total}</strong> 条
              </span>
              <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-slate-500">每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    setPageSize(Number.isInteger(v) ? v : 15)
                    setPage(1)
                  }}
                  className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                >
                  <option value={15}>15 条</option>
                  <option value={30}>30 条</option>
                  <option value={100}>100 条</option>
                </select>
              </label>
              <div className="inline-flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-0.5 rounded border border-slate-300 dark:border-slate-600 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  上一页
                </button>
                <span className="px-1 tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-0.5 rounded border border-slate-300 dark:border-slate-600 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none"
                >
                  下一页
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500">跳转</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={jumpPageInput}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyJumpToPage()
                  }}
                  className="w-12 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-center"
                  aria-label="页码"
                />
                <span className="text-slate-500">页</span>
                <button
                  type="button"
                  onClick={applyJumpToPage}
                  disabled={loading}
                  className="rounded bg-blue-600 text-white px-2.5 py-1 hover:bg-blue-500 disabled:opacity-50"
                >
                  确定
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 font-medium text-sm">
            任务详情与巡检记录
          </div>
          <div className="flex-1 overflow-auto max-h-[70vh] p-3 space-y-4">
            {!selectedId && (
              <p className="text-sm text-slate-500">请从左侧选择一条巡检任务</p>
            )}
            {selectedId && detailLoading && (
              <p className="text-sm text-slate-500">加载详情…</p>
            )}
            {selectedId && !detailLoading && detail && (
              <>
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-semibold min-w-0">
                      {detail.code} · {detail.planName}
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === detail.id}
                      onClick={() => void handleDeleteTask(detail.id)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/50 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除任务
                    </button>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    楼宇：{detail.buildingName ?? '-'} · 类型：{detail.inspectionType} · 计划日：
                    {formatDate(detail.scheduledDate)}
                  </div>
                  <div>
                    状态：<span className={getStatusColor(detail.status)}>{detail.status}</span> ·
                    进度：{detail.progress.done}/{detail.progress.total}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-600 pt-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-slate-600 dark:text-slate-400 min-w-0">
                        <span className="text-slate-500 dark:text-slate-500">人员：</span>
                        {!personnelEditing && (
                          <span>{detail.personnelNames ?? '-'}</span>
                        )}
                      </div>
                      {!personnelEditing ? (
                        <button
                          type="button"
                          onClick={startPersonnelEdit}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          指派 / 编辑
                        </button>
                      ) : (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={personnelSaving}
                            onClick={cancelPersonnelEdit}
                            className="rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs disabled:opacity-50"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            disabled={personnelSaving}
                            onClick={() => void savePersonnel()}
                            className="rounded-lg bg-blue-600 text-white px-2 py-1 text-xs hover:bg-blue-500 disabled:opacity-50"
                          >
                            {personnelSaving ? '保存中…' : '保存'}
                          </button>
                        </div>
                      )}
                    </div>
                    {personnelEditing && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-2 max-h-44 overflow-y-auto space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                        {employees.length === 0 &&
                        !(detail.assignedStaff ?? []).some((s) => !s.active) ? (
                          <p className="text-xs text-slate-500">
                            暂无在职员工，请先在员工管理中添加后再指派。
                          </p>
                        ) : (
                          <>
                            {employees.map((e) => (
                              <label
                                key={e.id}
                                className="flex items-center gap-2 cursor-pointer text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={personnelDraftIds.includes(e.id)}
                                  onChange={() => togglePersonnelDraft(e.id)}
                                  disabled={personnelSaving}
                                  className="rounded border-slate-300"
                                />
                                <span>{e.name}</span>
                              </label>
                            ))}
                            {(detail.assignedStaff ?? [])
                              .filter((s) => !s.active)
                              .map((s) => (
                                <label
                                  key={`inactive-${s.id}`}
                                  className="flex flex-wrap items-center gap-2 cursor-pointer text-sm text-amber-800 dark:text-amber-200/90"
                                >
                                  <input
                                    type="checkbox"
                                    checked={personnelDraftIds.includes(s.id)}
                                    onChange={() => togglePersonnelDraft(s.id)}
                                    disabled={personnelSaving}
                                    className="rounded border-slate-300"
                                  />
                                  <span>{s.name}</span>
                                  <span className="text-[11px] opacity-80">（已停用，可取消勾选移除）</span>
                                </label>
                              ))}
                          </>
                        )}
                        <p className="text-[11px] text-slate-400 pt-1">
                          取消勾选即移除该人员；保存后生效。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">
                    {taskMatchesInspectionCategory(detail.inspectionType, '设备')
                      ? '巡检点、NFC 与关联设备'
                      : '检查项与 NFC'}
                  </div>
                  <ul className="text-sm space-y-2">
                    {detail.checkItems.map((c, i) => {
                      const devs = c.linkedDevices ?? []
                      const imgs = c.pointImages ?? []
                      const thumbs = imgs.slice(0, 2)
                      const showDevices = taskMatchesInspectionCategory(
                        detail.inspectionType,
                        '设备'
                      )
                      const devicesCollapsed = collapsedCheckDeviceRows.has(i)
                      const pointDone = Boolean(c.tagId && recordDoneTagIds.has(c.tagId))
                      return (
                        <li
                          key={i}
                          className="rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-slate-700 dark:text-slate-300"
                        >
                          <div className="flex gap-3 items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {c.name}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {' '}
                                  — NFC {c.tagId}（{c.location || '—'}）
                                </span>
                              </div>
                              {showDevices && (
                                <div className="mt-2">
                                  {devs.length === 0 ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      本巡检点未绑定设备
                                    </p>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCollapsedCheckDeviceRows((prev) => {
                                            const next = new Set(prev)
                                            if (next.has(i)) next.delete(i)
                                            else next.add(i)
                                            return next
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        {devicesCollapsed ? (
                                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        关联设备 {devs.length} 台 ·{' '}
                                        {devicesCollapsed ? '展开' : '收起'}
                                      </button>
                                      {!devicesCollapsed && (
                                        <ul className="mt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-2">
                                          {devs.map((dev) => (
                                            <li
                                              key={dev.id}
                                              className="text-xs text-slate-600 dark:text-slate-300 pl-0.5"
                                            >
                                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                                {dev.name}
                                              </span>{' '}
                                              <span className="font-mono text-slate-500">{dev.code}</span>
                                              <span className="text-slate-500">
                                                {' '}
                                                {dev.type}
                                                {dev.location ? ` · ${dev.location}` : ''}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              <span
                                className={
                                  pointDone
                                    ? 'text-[11px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-300'
                                    : 'text-[11px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700/90 dark:text-slate-300'
                                }
                              >
                                {pointDone ? '已巡检' : '待巡检'}
                              </span>
                              {thumbs.length > 0 && (
                                <div className="flex gap-1.5">
                                  {thumbs.map((url, ti) => (
                                    <button
                                      key={`${i}-${ti}-${url}`}
                                      type="button"
                                      title="查看大图（左右键切换）"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setPointImageGallery({ urls: imgs, index: ti })
                                      }}
                                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                      <img
                                        src={url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">本任务巡检记录</div>
                  <table className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="text-left p-2">时间</th>
                        <th className="text-left p-2">NFC</th>
                        <th className="text-left p-2">位置</th>
                        <th className="text-left p-2">巡检结果</th>
                        <th className="text-left p-2">检查人</th>
                        <th className="text-left p-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.records.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500">
                            暂无记录
                          </td>
                        </tr>
                      ) : (
                        detail.records.map((r) => {
                          const abnormal = r.status === 'abnormal'
                          const recordDetailHref =
                            selectedId != null
                              ? `/inspection-records/${r.id}?returnTo=${encodeURIComponent(
                                  `/inspection-tasks?taskId=${selectedId}`
                                )}`
                              : `/inspection-records/${r.id}`
                          return (
                            <tr
                              key={r.id}
                              className="border-t border-slate-100 dark:border-slate-700"
                            >
                              <td className="p-2 whitespace-nowrap">{formatDate(r.checkedAt)}</td>
                              <td className="p-2 font-mono">{r.tagId}</td>
                              <td className="p-2">{r.location}</td>
                              <td className="p-2">
                                <span
                                  className={
                                    abnormal
                                      ? 'font-medium text-red-600 dark:text-red-400'
                                      : 'font-medium text-emerald-600 dark:text-emerald-400'
                                  }
                                >
                                  {abnormal ? '异常' : '正常'}
                                </span>
                              </td>
                              <td className="p-2">{r.checkedByName}</td>
                              <td className="p-2">
                                <Link
                                  href={recordDetailHref}
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  详情
                                </Link>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {generateDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => !generating && setGenerateDrawerOpen(false)}
          />
          <aside
            className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspection-generate-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/40">
              <h2
                id="inspection-generate-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                按周期生成任务
              </h2>
              <button
                type="button"
                disabled={generating}
                onClick={() => setGenerateDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 space-y-8">
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">运行日</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  留空则按<strong className="font-medium text-slate-600 dark:text-slate-300">北京时间当天</strong>
                  ；填写则按该日判断「这一天是否该执行」——例如每周计划只在配置的周几生成，所选日期若不是那些周几则会生成 0 条（属正常规则）。
                </p>
                <input
                  type="date"
                  value={genDrawerDate}
                  onChange={(e) => setGenDrawerDate(e.target.value)}
                  className="w-full max-w-xs px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      选择计划
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      可勾选一个或多个启用中的计划；至少选一项。计划中若关闭「定时自动生成」，仍可在此手动勾选生成。
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={selectAllPlans}
                      disabled={drawerPlansLoading || drawerPlans.length === 0 || generating}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPlans}
                      disabled={generating}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      全不选
                    </button>
                  </div>
                </div>

                {drawerPlansLoading ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 px-1 py-2">正在加载巡检计划…</p>
                ) : drawerPlans.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-3">
                    当前没有「启用中」的巡检计划，请先在巡检计划中启用计划后再生成任务。
                  </p>
                ) : (
                  <ul className="rounded-xl border border-slate-200 dark:border-slate-600 divide-y divide-slate-100 dark:divide-slate-700 max-h-[min(52vh,420px)] overflow-y-auto">
                    {drawerPlans.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-start gap-3 px-3 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                      >
                        <input
                          type="checkbox"
                          id={`gen-plan-${p.id}`}
                          checked={selectedPlanIds.has(p.id)}
                          onChange={() => togglePlanId(p.id)}
                          disabled={generating}
                          className="mt-1 rounded border-slate-300"
                        />
                        <label
                          htmlFor={`gen-plan-${p.id}`}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.inspectionType} · {p.buildingName}
                            {p.autoGenerateTasks === false ? (
                              <span className="ml-1 text-amber-700 dark:text-amber-300">· 未开定时自动</span>
                            ) : null}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 px-5 py-4 bg-slate-50/80 dark:bg-slate-900/40">
              <button
                type="button"
                disabled={generating}
                onClick={() => setGenerateDrawerOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
              >
                取消
              </button>
              <button
                type="button"
                disabled={
                  generating ||
                  drawerPlansLoading ||
                  drawerPlans.length === 0 ||
                  selectedPlanIds.size < 1
                }
                onClick={() => void handleConfirmGenerate()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {generating ? '生成中…' : '开始生成'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {batchAssignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !batchAssignSaving && setBatchAssignOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl max-h-[min(90vh,520px)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-assign-title"
          >
            <h3 id="batch-assign-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              批量指派人员
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              已选 <strong className="text-slate-700 dark:text-slate-200">{batchSelectedIds.size}</strong>{' '}
              条任务。下方勾选的人员将<strong className="text-slate-800 dark:text-slate-100">覆盖</strong>
              这些任务原有人员；可不选任何人以清空人员。
            </p>
            <div className="mt-4 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
              {employees.length === 0 ? (
                <p className="text-sm text-slate-500">暂无在职员工，请先在员工管理中添加。</p>
              ) : (
                employees.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2 cursor-pointer text-sm text-slate-800 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={batchUserDraftIds.includes(e.id)}
                      onChange={() => toggleBatchUserDraft(e.id)}
                      disabled={batchAssignSaving}
                      className="rounded border-slate-300"
                    />
                    <span>{e.name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={batchAssignSaving}
                onClick={() => setBatchAssignOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={batchAssignSaving}
                onClick={() => void saveBatchAssign()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {batchAssignSaving ? '保存中…' : '确定指派'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pointImageGallery && pointImageGallery.urls.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/92"
          role="dialog"
          aria-modal="true"
          aria-label="巡检点图片预览"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white text-sm shrink-0">
            <span className="tabular-nums">
              {pointImageGallery.index + 1} / {pointImageGallery.urls.length}
            </span>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 hover:bg-white/10 text-white"
              onClick={() => setPointImageGallery(null)}
            >
              关闭
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center relative px-10 sm:px-14 min-h-0 touch-pan-y"
            onClick={() => setPointImageGallery(null)}
          >
            <button
              type="button"
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-25"
              disabled={pointImageGallery.urls.length < 2}
              onClick={(e) => {
                e.stopPropagation()
                setPointImageGallery((g) =>
                  g
                    ? {
                        urls: g.urls,
                        index: (g.index - 1 + g.urls.length) % g.urls.length,
                      }
                    : null
                )
              }}
              aria-label="上一张"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              type="button"
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-25"
              disabled={pointImageGallery.urls.length < 2}
              onClick={(e) => {
                e.stopPropagation()
                setPointImageGallery((g) =>
                  g ? { urls: g.urls, index: (g.index + 1) % g.urls.length } : null
                )
              }}
              aria-label="下一张"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
            <img
              src={pointImageGallery.urls[pointImageGallery.index]}
              alt=""
              className="max-h-[min(85vh,100%)] max-w-full object-contain select-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <p className="text-center text-white/55 text-xs py-2 shrink-0">Esc 关闭，← → 切换</p>
        </div>
      )}

    </div>
  )
}
