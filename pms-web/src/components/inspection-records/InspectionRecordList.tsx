'use client'

import { useState, useEffect, useMemo } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Search } from 'lucide-react'

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
}

type Building = { id: number; name: string }

export function InspectionRecordList({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean
}) {
  const [keyword, setKeyword] = useState('')
  const [taskCode, setTaskCode] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [inspectionType, setInspectionType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [list, setList] = useState<InspectionRecord[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [inspectionTypes, setInspectionTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailRow, setDetailRow] = useState<InspectionRecord | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (keyword.trim()) params.set('keyword', keyword.trim())
      if (taskCode.trim()) params.set('taskCode', taskCode.trim())
      if (buildingId) params.set('buildingId', buildingId)
      if (inspectionType) params.set('inspectionType', inspectionType)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/inspection-records?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '加载失败')
        setList([])
        return
      }
      setList(json.data?.list ?? [])
      setBuildings(json.data?.buildings ?? [])
      setInspectionTypes(json.data?.inspectionTypes ?? [])
    } catch {
      setError('网络错误')
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const applyFilters = () => {
    void fetchData()
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

  const statusLabel: Record<string, string> = {
    normal: '正常',
    abnormal: '异常',
  }

  const buildingName = (id: number | null) =>
    id == null ? '—' : buildings.find((b) => b.id === id)?.name ?? `#${id}`

  const parseDetail = (raw: string | null) => {
    if (!raw) return null as { remark?: string; images?: string[] } | null
    try {
      return JSON.parse(raw) as { remark?: string; images?: string[] }
    } catch {
      return null
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs text-slate-500 mb-1">关键词</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="任务编号、位置、NFC、类型"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              />
            </div>
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs text-slate-500 mb-1">任务编号</label>
            <input
              type="text"
              value={taskCode}
              onChange={(e) => setTaskCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs text-slate-500 mb-1">楼宇</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
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
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value)}
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
          <div className="min-w-[130px]">
            <label className="block text-xs text-slate-500 mb-1">检查时间起</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs text-slate-500 mb-1">检查时间止</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
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
              <th className="text-left p-4 font-medium">记录ID</th>
              <th className="text-left p-4 font-medium">任务编号</th>
              <th className="text-left p-4 font-medium">计划</th>
              <th className="text-left p-4 font-medium">楼宇</th>
              <th className="text-left p-4 font-medium">NFC</th>
              <th className="text-left p-4 font-medium">巡检类型</th>
              <th className="text-left p-4 font-medium">位置</th>
              <th className="text-left p-4 font-medium">检查时间</th>
              <th className="text-left p-4 font-medium">检查人</th>
              <th className="text-left p-4 font-medium w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4">{r.id}</td>
                <td className="p-4 font-medium">{r.taskCode}</td>
                <td className="p-4">{r.planName ?? '—'}</td>
                <td className="p-4">{buildingName(r.buildingId)}</td>
                <td className="p-4 font-mono text-xs">{r.tagId}</td>
                <td className="p-4">{r.inspectionType}</td>
                <td className="p-4">{r.location}</td>
                <td className="p-4">{formatDate(r.checkedAt)}</td>
                <td className="p-4">{r.checkedByName}</td>
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => setDetailRow(r)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
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

      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">巡检记录详情</h3>
            <div className="text-sm space-y-1 text-slate-600 dark:text-slate-300">
              <div>任务：{detailRow.taskCode}</div>
              <div>NFC：{detailRow.tagId}</div>
              <div>位置：{detailRow.location}</div>
              <div>时间：{formatDate(detailRow.checkedAt)}</div>
              <div>检查人：{detailRow.checkedByName}</div>
              <div>状态：{statusLabel[detailRow.status] ?? detailRow.status}</div>
            </div>
            {(() => {
              const d = parseDetail(detailRow.detail)
              if (!d) return null
              return (
                <div className="mt-3 text-sm space-y-2">
                  {d.remark && (
                    <div>
                      <span className="font-medium">情况说明：</span>
                      {d.remark}
                    </div>
                  )}
                  {d.images && d.images.length > 0 && (
                    <div>
                      <span className="font-medium">图片：</span>
                      <ul className="list-disc pl-5 mt-1">
                        {d.images.map((u, i) => (
                          <li key={i} className="break-all">
                            <a href={u} target="_blank" rel="noreferrer" className="text-blue-600">
                              {u}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}
            <button
              type="button"
              onClick={() => setDetailRow(null)}
              className="mt-4 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
