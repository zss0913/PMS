'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { PopoverDateRangeField } from '@/components/ui/PopoverDateRangeField'

type InspectionRecord = {
  id: number
  taskId: number
  taskCode: string
  planName: string | null
  buildingId: number | null
  inspectionType: string
  tagId: string
  location: string
  checkedAt: string
  checkedByName: string
  status: string
  detail: string | null
  linkedWorkOrder: { id: number; code: string } | null
}

type Building = { id: number; name: string }

export function InspectionRecordList({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [taskCodeInput, setTaskCodeInput] = useState('')
  const [buildingIdInput, setBuildingIdInput] = useState('')
  const [inspectionTypeInput, setInspectionTypeInput] = useState('')
  const [resultStatusInput, setResultStatusInput] = useState('')
  const [dateFromInput, setDateFromInput] = useState('')
  const [dateToInput, setDateToInput] = useState('')
  const [list, setList] = useState<InspectionRecord[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const listReturnPath = useMemo(() => {
    const q = searchParams.toString()
    return q ? `/inspection-records?${q}` : '/inspection-records'
  }, [searchParams])

  useEffect(() => {
    setTaskCodeInput(searchParams.get('taskCode') ?? '')
    setBuildingIdInput(searchParams.get('buildingId') ?? '')
    setInspectionTypeInput(searchParams.get('inspectionType') ?? '')
    const rs = searchParams.get('resultStatus') ?? ''
    setResultStatusInput(rs === 'normal' || rs === 'abnormal' ? rs : '')
    setDateFromInput(searchParams.get('dateFrom') ?? '')
    setDateToInput(searchParams.get('dateTo') ?? '')
  }, [searchParams])

  useEffect(() => {
    if (isSuperAdmin) return
    const params = new URLSearchParams()
    const tc = searchParams.get('taskCode')?.trim()
    if (tc) params.set('taskCode', tc)
    const bid = searchParams.get('buildingId')?.trim()
    if (bid) params.set('buildingId', bid)
    const it = searchParams.get('inspectionType')?.trim()
    if (it) params.set('inspectionType', it)
    const df = searchParams.get('dateFrom')?.trim()
    if (df) params.set('dateFrom', df)
    const dt = searchParams.get('dateTo')?.trim()
    if (dt) params.set('dateTo', dt)
    const rs = searchParams.get('resultStatus')?.trim()
    if (rs === 'normal' || rs === 'abnormal') params.set('resultStatus', rs)

    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/inspection-records?${params}`, { credentials: 'include' })
        const json = await res.json()
        if (cancelled) return
        if (!json.success) {
          setError(json.message || '加载失败')
          setList([])
          return
        }
        setList(json.data?.list ?? [])
        setBuildings(json.data?.buildings ?? [])
        setInspectionTypes(json.data?.inspectionTypes ?? [])
      } catch {
        if (!cancelled) {
          setError('网络错误')
          setList([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin, searchParams])

  const applyFilters = () => {
    const p = new URLSearchParams()
    if (taskCodeInput.trim()) p.set('taskCode', taskCodeInput.trim())
    if (buildingIdInput) p.set('buildingId', buildingIdInput)
    if (inspectionTypeInput) p.set('inspectionType', inspectionTypeInput)
    if (dateFromInput) p.set('dateFrom', dateFromInput)
    if (dateToInput) p.set('dateTo', dateToInput)
    if (resultStatusInput === 'normal' || resultStatusInput === 'abnormal') {
      p.set('resultStatus', resultStatusInput)
    }
    router.replace(`/inspection-records?${p.toString()}`, { scroll: false })
  }

  const filtered = useMemo(() => list, [list])
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法查看巡检记录</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
      </div>
    )
  }

  if (loading && list.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  if (error && list.length === 0) {
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

  const buildingName = (id: number | null) =>
    id == null ? '—' : buildings.find((b) => b.id === id)?.name ?? `#${id}`

  const recordDetailHref = (recordId: number) =>
    `/inspection-records/${recordId}?returnTo=${encodeURIComponent(listReturnPath)}`

  const workOrderDetailHref = (workOrderId: number) =>
    `/work-orders/${workOrderId}?returnTo=${encodeURIComponent(listReturnPath)}`

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[140px] flex-1 sm:max-w-xs">
            <label className="block text-xs text-slate-500 mb-1">任务编号 / 任务名称</label>
            <input
              type="text"
              placeholder="模糊查询任务编号或计划名称"
              value={taskCodeInput}
              onChange={(e) => setTaskCodeInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs text-slate-500 mb-1">楼宇</label>
            <select
              value={buildingIdInput}
              onChange={(e) => setBuildingIdInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs text-slate-500 mb-1">巡检类型</label>
            <select
              value={inspectionTypeInput}
              onChange={(e) => setInspectionTypeInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部</option>
              {inspectionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs text-slate-500 mb-1">巡检结果</label>
            <select
              value={resultStatusInput}
              onChange={(e) => setResultStatusInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部</option>
              <option value="normal">正常</option>
              <option value="abnormal">异常</option>
            </select>
          </div>
          <PopoverDateRangeField
            label="检查时间"
            start={dateFromInput}
            end={dateToInput}
            onChange={({ start, end }) => {
              setDateFromInput(start)
              setDateToInput(end)
            }}
            className="min-w-[260px] sm:min-w-[320px] max-w-md"
          />
          <button
            type="button"
            onClick={applyFilters}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 h-[38px]"
          >
            查询
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">任务编号</th>
              <th className="text-left p-4 font-medium">计划</th>
              <th className="text-left p-4 font-medium">楼宇</th>
              <th className="text-left p-4 font-medium">NFC</th>
              <th className="text-left p-4 font-medium">巡检类型</th>
              <th className="text-left p-4 font-medium">位置</th>
              <th className="text-left p-4 font-medium">巡检结果</th>
              <th className="text-left p-4 font-medium">检查时间</th>
              <th className="text-left p-4 font-medium">检查人</th>
              <th className="text-left p-4 font-medium">关联工单</th>
              <th className="text-left p-4 font-medium w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((r) => {
              const abnormal = r.status === 'abnormal'
              return (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{r.taskCode}</td>
                <td className="p-4">{r.planName ?? '—'}</td>
                <td className="p-4">{buildingName(r.buildingId)}</td>
                <td className="p-4 font-mono text-xs">{r.tagId}</td>
                <td className="p-4">{r.inspectionType}</td>
                <td className="p-4">{r.location}</td>
                <td className="p-4">
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
                <td className="p-4">{formatDate(r.checkedAt)}</td>
                <td className="p-4">{r.checkedByName}</td>
                <td className="p-4">
                  {r.linkedWorkOrder ? (
                    <Link
                      href={workOrderDetailHref(r.linkedWorkOrder.id)}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      {r.linkedWorkOrder.code}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="p-4">
                  <Link
                    href={recordDetailHref(r.id)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    详情
                  </Link>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">暂无巡检记录</div>
      )}
      {filtered.length > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
