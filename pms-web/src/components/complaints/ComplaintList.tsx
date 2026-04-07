'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import {
  Search,
  UserPlus,
  CheckCircle,
  RotateCcw,
  CalendarRange,
  Building2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { normalizeComplaintStatus } from '@/lib/complaint-status'

type TabKey = 'all' | 'pending' | 'processing' | 'completed'

const TAB_LABEL: Record<TabKey, string> = {
  all: '全部',
  pending: '待处理',
  processing: '处理中',
  completed: '已处理',
}

const TABS: TabKey[] = ['all', 'pending', 'processing', 'completed']

type Complaint = {
  id: number
  tenantId: number
  complainant: string
  description: string
  buildingId: number
  buildingName: string
  status: string
  images: string[]
  assignedTo: number | null
  assignedToName: string | null
  handledByName: string | null
  result: string | null
  createdAt: string
}

type FilterState = {
  /** 仅匹配租客（公司）名称 */
  tenantKeyword: string
  /** YYYY-MM-DD，空表示不限制 */
  dateFrom: string
  dateTo: string
  /** 空字符串表示全部楼宇 */
  buildingId: string
}

function emptyFilter(): FilterState {
  return { tenantKeyword: '', dateFrom: '', dateTo: '', buildingId: '' }
}

const INITIAL_FILTER: Record<TabKey, FilterState> = {
  all: emptyFilter(),
  pending: emptyFilter(),
  processing: emptyFilter(),
  completed: emptyFilter(),
}

function matchesTenantName(c: Complaint, kw: string) {
  const k = kw.trim()
  if (!k) return true
  return c.complainant.toLowerCase().includes(k.toLowerCase())
}

function matchesBuildingFilter(c: Complaint, buildingId: string) {
  if (!buildingId.trim()) return true
  const n = Number(buildingId)
  if (Number.isNaN(n)) return true
  return c.buildingId === n
}

function matchesCreatedRange(c: Complaint, from: string, to: string) {
  const t = new Date(c.createdAt).getTime()
  if (from.trim()) {
    const p = from.split('-').map(Number)
    if (p.length === 3) {
      const start = new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0).getTime()
      if (t < start) return false
    }
  }
  if (to.trim()) {
    const p = to.split('-').map(Number)
    if (p.length === 3) {
      const end = new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).getTime()
      if (t > end) return false
    }
  }
  return true
}

function matchesFilters(c: Complaint, f: FilterState) {
  return (
    matchesTenantName(c, f.tenantKeyword) &&
    matchesCreatedRange(c, f.dateFrom, f.dateTo) &&
    matchesBuildingFilter(c, f.buildingId)
  )
}

const MAX_FINISH_MEDIA = 12
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024

function isVideoUrl(path: string) {
  return /\.(mp4|mov|webm)(\?.*)?$/i.test(path)
}

type Employee = { id: number; name: string }

type BuildingOpt = { id: number; name: string }

type ApiData = {
  list: Complaint[]
  employees: Employee[]
  buildings: BuildingOpt[]
  currentUserId: number
}

export function ComplaintList({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [draftFilter, setDraftFilter] = useState<Record<TabKey, FilterState>>(() => ({
    ...INITIAL_FILTER,
  }))
  const [queryFilter, setQueryFilter] = useState<Record<TabKey, FilterState>>(() => ({
    ...INITIAL_FILTER,
  }))
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [acceptOpen, setAcceptOpen] = useState<Complaint | null>(null)
  const [acceptAssignee, setAcceptAssignee] = useState(0)

  const [finishOpen, setFinishOpen] = useState<Complaint | null>(null)
  const [finishResult, setFinishResult] = useState('')
  const [finishImages, setFinishImages] = useState<string[]>([])
  const [finishPreviewIndex, setFinishPreviewIndex] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/complaints', { credentials: 'include' })
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
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const list = data?.list ?? []
  const employees = data?.employees ?? []
  const buildings = data?.buildings ?? []
  const currentUserId = data?.currentUserId ?? 0

  const tabCounts = useMemo(
    () => ({
      all: list.length,
      pending: list.filter((c) => normalizeComplaintStatus(c.status) === '待处理').length,
      processing: list.filter((c) => normalizeComplaintStatus(c.status) === '处理中').length,
      completed: list.filter((c) => normalizeComplaintStatus(c.status) === '已处理').length,
    }),
    [list]
  )

  const matchesTab = (c: Complaint, tab: TabKey) => {
    const s = normalizeComplaintStatus(c.status)
    if (tab === 'all') return true
    if (tab === 'pending') return s === '待处理'
    if (tab === 'processing') return s === '处理中'
    if (tab === 'completed') return s === '已处理'
    return true
  }

  const filteredList = useMemo(() => {
    const f = queryFilter[activeTab]
    return list.filter((c) => matchesTab(c, activeTab) && matchesFilters(c, f))
  }, [list, activeTab, queryFilter])

  const {
    page,
    pageSize,
    total,
    paginatedItems,
    handlePageChange,
    handlePageSizeChange,
    setPage,
  } = usePagination(filteredList, 15)

  useEffect(() => {
    setPage(1)
  }, [activeTab, queryFilter, setPage])

  const applySearch = () => {
    const d = draftFilter[activeTab]
    if (d.dateFrom && d.dateTo && d.dateFrom > d.dateTo) {
      alert('开始日期不能晚于结束日期')
      return
    }
    setQueryFilter((prev) => ({ ...prev, [activeTab]: { ...d } }))
  }

  const resetSearch = () => {
    const empty = emptyFilter()
    setDraftFilter((prev) => ({ ...prev, [activeTab]: { ...empty } }))
    setQueryFilter((prev) => ({ ...prev, [activeTab]: { ...empty } }))
  }

  const setDraftField = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setDraftFilter((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [key]: value },
    }))
  }

  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm'
  const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1'

  const openAccept = (c: Complaint) => {
    setAcceptOpen(c)
    setAcceptAssignee(employees[0]?.id ?? 0)
  }

  const submitAccept = async () => {
    if (!acceptOpen || !acceptAssignee) {
      alert('请选择处理人')
      return
    }
    setBusyId(acceptOpen.id)
    try {
      const res = await fetch(`/api/complaints/${acceptOpen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: '处理中', assignedTo: acceptAssignee }),
      })
      const json = await res.json()
      if (json.success) {
        setAcceptOpen(null)
        fetchData()
      } else {
        alert(json.message || '操作失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setBusyId(null)
    }
  }

  const openFinish = (c: Complaint) => {
    setFinishOpen(c)
    setFinishResult('')
    setFinishImages([])
    setFinishPreviewIndex(null)
  }

  const removeFinishAt = (idx: number) => {
    setFinishImages((prev) => prev.filter((_, i) => i !== idx))
    setFinishPreviewIndex((i) => {
      if (i === null) return null
      if (i === idx) return null
      if (i > idx) return i - 1
      return i
    })
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return
    let next = [...finishImages]
    const room = MAX_FINISH_MEDIA - next.length
    if (room <= 0) {
      alert(`最多上传 ${MAX_FINISH_MEDIA} 个文件`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const toUpload = Array.from(files).slice(0, room)
    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i]
      const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name)
      const maxB = isVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
      if (file.size > maxB) {
        alert(`${file.name} 超过大小限制（图片 10MB / 视频 50MB）`)
        continue
      }
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/work-orders/upload-image', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        })
        const json = await res.json()
        if (json.success && json.data?.url) next.push(json.data.url as string)
        else alert(json.message || `上传失败：${file.name}`)
      } catch {
        alert(`上传失败：${file.name}`)
      }
    }
    setFinishImages(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  useEffect(() => {
    if (finishPreviewIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFinishPreviewIndex(null)
      if (e.key === 'ArrowLeft') {
        setFinishPreviewIndex((i) => {
          if (i === null || finishImages.length === 0) return null
          return (i - 1 + finishImages.length) % finishImages.length
        })
      }
      if (e.key === 'ArrowRight') {
        setFinishPreviewIndex((i) => {
          if (i === null || finishImages.length === 0) return null
          return (i + 1) % finishImages.length
        })
      }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [finishPreviewIndex, finishImages.length])

  const submitFinish = async () => {
    if (!finishOpen || !finishResult.trim()) {
      alert('请填写处理结果')
      return
    }
    setBusyId(finishOpen.id)
    try {
      const res = await fetch(`/api/complaints/${finishOpen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: '已处理',
          result: finishResult.trim(),
          ...(finishImages.length > 0 ? { resultImages: finishImages } : {}),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setFinishOpen(null)
        setFinishPreviewIndex(null)
        fetchData()
      } else {
        alert(json.message || '操作失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setBusyId(null)
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

  const complaintCode = (id: number) => 'C' + String(id).padStart(5, '0')

  const renderActionCell = (c: Complaint) => {
    const st = normalizeComplaintStatus(c.status)
    if (activeTab === 'completed') return null
    if (st === '待处理') {
      return (
        <button
          type="button"
          onClick={() => openAccept(c)}
          disabled={busyId === c.id}
          className="flex items-center gap-1 text-sm text-amber-600 hover:underline disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" />
          受理并指派
        </button>
      )
    }
    if (st === '处理中') {
      return (
        <div className="flex flex-col gap-1">
          {c.assignedTo === currentUserId && (
            <button
              type="button"
              onClick={() => openFinish(c)}
              disabled={busyId === c.id}
              className="flex items-center gap-1 text-sm text-green-600 hover:underline disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              办结
            </button>
          )}
          {c.assignedTo !== currentUserId && (
            <span className="text-xs text-slate-500">待指派人处理</span>
          )}
        </div>
      )
    }
    if (st === '已处理' && c.result) {
      return (
        <span className="text-xs text-slate-500 line-clamp-2" title={c.result}>
          结果：{c.result}
        </span>
      )
    }
    return <span className="text-xs text-slate-400">—</span>
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="px-4 pt-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/80 dark:bg-slate-700/40'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {TAB_LABEL[tab]}
                <span className="ml-1 font-normal text-slate-400">({tabCounts[tab]})</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500 shrink-0 pb-2 lg:pb-0">
            租客仅可在租客端提交吐槽
          </p>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          筛选条件（当前 Tab：{TAB_LABEL[activeTab]}；默认不填即查全部；各 Tab 条件独立，点「查询」生效）
        </p>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
            <div className="min-w-0">
              <label className={labelCls}>租客名称</label>
              <input
                type="text"
                placeholder="按租客（公司）名称包含匹配"
                value={draftFilter[activeTab].tenantKeyword}
                onChange={(e) => setDraftField('tenantKeyword', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="min-w-0 md:col-span-2">
              <label className={labelCls}>
                <span className="inline-flex items-center gap-1">
                  <CalendarRange className="w-3.5 h-3.5" />
                  创建时间范围
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={draftFilter[activeTab].dateFrom}
                  onChange={(e) => setDraftField('dateFrom', e.target.value)}
                  className={`${inputCls} flex-1 min-w-[140px]`}
                />
                <span className="text-slate-500 text-sm shrink-0">至</span>
                <input
                  type="date"
                  value={draftFilter[activeTab].dateTo}
                  onChange={(e) => setDraftField('dateTo', e.target.value)}
                  className={`${inputCls} flex-1 min-w-[140px]`}
                />
              </div>
            </div>
            <div className="min-w-0">
              <label className={labelCls}>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  楼宇
                </span>
              </label>
              <select
                value={draftFilter[activeTab].buildingId}
                onChange={(e) => setDraftField('buildingId', e.target.value)}
                className={inputCls}
              >
                <option value="">全部楼宇</option>
                {buildings.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applySearch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              <Search className="w-4 h-4" />
              查询
            </button>
            <button
              type="button"
              onClick={() => resetSearch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          </div>
        </div>
      </div>

      {list.length === 0 && (
        <div className="p-12 text-center text-slate-500">暂无卫生吐槽</div>
      )}

      {list.length > 0 && filteredList.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          当前列表无匹配记录，请调整筛选条件后点击「查询」
        </div>
      )}

      {list.length > 0 && filteredList.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left p-4 font-medium">编号</th>
                  <th className="text-left p-4 font-medium">租客</th>
                  <th className="text-left p-4 font-medium">内容</th>
                  <th className="text-left p-4 font-medium">楼宇</th>
                  {activeTab === 'all' && (
                    <th className="text-left p-4 font-medium">状态</th>
                  )}
                  <th className="text-left p-4 font-medium">处理人</th>
                  <th className="text-left p-4 font-medium">创建时间</th>
                  {activeTab === 'completed' ? (
                    <th className="text-left p-4 font-medium">详情 / 处理结果</th>
                  ) : (
                    <th className="text-left p-4 font-medium w-52">详情 / 操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((c) => {
                  const st = normalizeComplaintStatus(c.status)
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="p-4 font-medium">{complaintCode(c.id)}</td>
                      <td className="p-4">{c.complainant}</td>
                      <td className="p-4 max-w-[220px]">
                        <p className="truncate" title={c.description}>
                          {c.description}
                        </p>
                        {c.images.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">{c.images.length} 张图</p>
                        )}
                      </td>
                      <td className="p-4">{c.buildingName}</td>
                      {activeTab === 'all' && <td className="p-4">{st}</td>}
                      <td className="p-4 text-sm">
                        {st === '待处理' ? '—' : (c.assignedToName ?? '-')}
                      </td>
                      <td className="p-4">{formatDate(c.createdAt)}</td>
                      {activeTab === 'completed' ? (
                        <td className="p-4 max-w-[260px] align-top">
                          <Link
                            href={`/complaints/${c.id}`}
                            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            查看详情
                          </Link>
                          {c.result ? (
                            <p
                              className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mt-2"
                              title={c.result}
                            >
                              {c.result}
                            </p>
                          ) : (
                            <span className="text-xs text-slate-400 block mt-2">—</span>
                          )}
                        </td>
                      ) : (
                        <td className="p-4 align-top">
                          <Link
                            href={`/complaints/${c.id}`}
                            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 block mb-2"
                          >
                            查看详情
                          </Link>
                          {renderActionCell(c)}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}

      {acceptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-4 shadow-xl space-y-3">
            <h3 className="font-semibold">受理为处理中</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {complaintCode(acceptOpen.id)} · {acceptOpen.complainant}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">指派处理人 *</label>
              <select
                value={acceptAssignee}
                onChange={(e) => setAcceptAssignee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value={0}>请选择</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptOpen(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitAccept()}
                disabled={busyId != null}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white disabled:opacity-50"
              >
                确认受理
              </button>
            </div>
          </div>
        </div>
      )}

      {finishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">办结（已处理）</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {complaintCode(finishOpen.id)} · 请填写处理结果说明（必填）
            </p>
            <textarea
              value={finishResult}
              onChange={(e) => setFinishResult(e.target.value)}
              rows={4}
              placeholder="处理情况说明"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
            <div>
              <label className="block text-sm font-medium mb-2">
                处理现场图片 / 视频（选填，最多 {MAX_FINISH_MEDIA} 个）
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,video/mp4,video/quicktime,.mp4,.mov,.webm"
                multiple
                className="sr-only"
                aria-hidden
                onChange={(e) => void uploadFiles(e.target.files)}
              />
              <div className="flex flex-wrap gap-2">
                {finishImages.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative group">
                    <button
                      type="button"
                      onClick={() => setFinishPreviewIndex(idx)}
                      className="w-[88px] h-[88px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {isVideoUrl(url) ? (
                        <video
                          src={url}
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFinishAt(idx)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md opacity-90 hover:opacity-100"
                      aria-label="移除"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {isVideoUrl(url) && (
                      <span className="pointer-events-none absolute bottom-1 left-1 rounded px-1 text-[10px] font-medium bg-black/55 text-white">
                        视频
                      </span>
                    )}
                  </div>
                ))}
                {finishImages.length < MAX_FINISH_MEDIA && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-[88px] h-[88px] rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Plus className="w-8 h-8" strokeWidth={2} />
                    <span className="text-[11px]">添加</span>
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                支持 jpg / png / mp4；点击缩略图可全屏预览，左右切换查看。
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFinishOpen(null)
                  setFinishPreviewIndex(null)
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitFinish()}
                disabled={busyId != null}
                className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50"
              >
                确认办结
              </button>
            </div>
          </div>
        </div>
      )}

      {finishPreviewIndex !== null &&
        finishImages.length > 0 &&
        finishPreviewIndex < finishImages.length && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/88 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="媒体预览"
            onClick={() => setFinishPreviewIndex(null)}
          >
            <button
              type="button"
              className="absolute top-3 right-3 z-10 rounded-full p-2 text-white/90 hover:bg-white/10"
              aria-label="关闭"
              onClick={() => setFinishPreviewIndex(null)}
            >
              <X className="w-6 h-6" />
            </button>
            {finishImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/90 hover:bg-white/10 md:left-6"
                  aria-label="上一张"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFinishPreviewIndex((i) =>
                      i === null ? null : (i - 1 + finishImages.length) % finishImages.length
                    )
                  }}
                >
                  <ChevronLeft className="w-9 h-9 md:w-10 md:h-10" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/90 hover:bg-white/10 md:right-6"
                  aria-label="下一张"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFinishPreviewIndex((i) =>
                      i === null ? null : (i + 1) % finishImages.length
                    )
                  }}
                >
                  <ChevronRight className="w-9 h-9 md:w-10 md:h-10" />
                </button>
              </>
            )}
            <div
              className="relative max-h-[85vh] max-w-[min(96vw,960px)] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {isVideoUrl(finishImages[finishPreviewIndex]) ? (
                <video
                  src={finishImages[finishPreviewIndex]}
                  controls
                  className="max-h-[85vh] max-w-full rounded-lg shadow-lg"
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={finishImages[finishPreviewIndex]}
                  alt=""
                  className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/85">
              {finishPreviewIndex + 1} / {finishImages.length}
            </p>
          </div>
        )}
    </div>
  )
}
