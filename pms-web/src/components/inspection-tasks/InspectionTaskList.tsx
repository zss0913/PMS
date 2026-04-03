'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDate } from '@/lib/utils'

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

type CheckItemRow = {
  name: string
  nfcTagId: number
  tagId: string
  location: string
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

type TaskDetail = {
  id: number
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  buildingName: string | null
  personnelNames?: string
  checkItems: CheckItemRow[]
  progress: { total: number; done: number }
  records: RecordRow[]
}

type Building = { id: number; name: string }

type ApiListData = {
  list: InspectionTask[]
  buildings: Building[]
  statusOptions: string[]
}

export function InspectionTaskList() {
  const [data, setData] = useState<ApiListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [buildingFilter, setBuildingFilter] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genDate, setGenDate] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [recordFocus, setRecordFocus] = useState<RecordRow | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (buildingFilter) params.set('buildingId', buildingFilter)
      const res = await fetch(`/api/inspection-tasks?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        if (selectedId && !json.data.list.some((t: InspectionTask) => t.id === selectedId)) {
          setSelectedId(null)
          setDetail(null)
        }
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/inspection-tasks/${id}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        setDetail({
          ...d,
          personnelNames: d.personnelNames ?? '-',
          records: d.records ?? [],
        })
      } else {
        setDetail(null)
      }
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [statusFilter, dateFrom, dateTo, buildingFilter])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const q = genDate.trim() ? `?date=${encodeURIComponent(genDate.trim())}` : ''
      const res = await fetch(`/api/inspection-tasks/generate${q}`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) {
        loadData()
        alert(`已生成 ${json.data.created} 个任务（运行日 ${json.data.runDate?.slice(0, 10) ?? '今天'}）`)
      } else {
        alert(json.message || '生成失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setGenerating(false)
    }
  }

  const list = data?.list ?? []
  const statusOptions = data?.statusOptions ?? ['待执行', '巡检中', '已完成', '已逾期']
  const buildings = data?.buildings ?? []

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

  const parseDetail = (raw: string | null) => {
    if (!raw) return null as { remark?: string; images?: string[] } | null
    try {
      return JSON.parse(raw) as { remark?: string; images?: string[] }
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">状态</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            onChange={(e) => setBuildingFilter(e.target.value)}
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
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">计划日期起</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">计划日期止</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs text-slate-500 mb-1">生成指定日（可选）</label>
          <input
            type="date"
            value={genDate}
            onChange={(e) => setGenDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {generating ? '生成中...' : '按周期生成任务'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[480px]">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 font-medium text-sm">
            任务列表
          </div>
          <div className="flex-1 overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left p-2 font-medium">编号</th>
                  <th className="text-left p-2 font-medium">计划</th>
                  <th className="text-left p-2 font-medium">计划日</th>
                  <th className="text-left p-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : (
                  list.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${
                        selectedId === t.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="p-2 font-mono text-xs">{t.code}</td>
                      <td className="p-2">{t.planName}</td>
                      <td className="p-2 whitespace-nowrap">{formatDate(t.scheduledDate)}</td>
                      <td className="p-2">
                        <span className={getStatusColor(t.status)}>{t.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && list.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm">暂无任务</div>
            )}
          </div>
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
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-1 text-sm">
                  <div className="font-semibold">
                    {detail.code} · {detail.planName}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    楼宇：{detail.buildingName ?? '-'} · 类型：{detail.inspectionType} · 计划日：
                    {formatDate(detail.scheduledDate)}
                  </div>
                  <div>
                    状态：<span className={getStatusColor(detail.status)}>{detail.status}</span> ·
                    进度：{detail.progress.done}/{detail.progress.total} · 人员：
                    {detail.personnelNames}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">检查项与 NFC</div>
                  <ul className="text-sm space-y-1 list-disc pl-5 text-slate-700 dark:text-slate-300">
                    {detail.checkItems.map((c, i) => (
                      <li key={i}>
                        {c.name} — NFC {c.tagId}（{c.location || '—'}）
                      </li>
                    ))}
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
                        <th className="text-left p-2">检查人</th>
                        <th className="text-left p-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.records.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-500">
                            暂无记录
                          </td>
                        </tr>
                      ) : (
                        detail.records.map((r) => (
                          <tr
                            key={r.id}
                            className="border-t border-slate-100 dark:border-slate-700"
                          >
                            <td className="p-2 whitespace-nowrap">{formatDate(r.checkedAt)}</td>
                            <td className="p-2 font-mono">{r.tagId}</td>
                            <td className="p-2">{r.location}</td>
                            <td className="p-2">{r.checkedByName}</td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() => setRecordFocus(r)}
                                className="text-blue-600 hover:underline"
                              >
                                详情
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {recordFocus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRecordFocus(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">巡检记录详情</h3>
            <div className="text-sm space-y-1 text-slate-600 dark:text-slate-300">
              <div>NFC：{recordFocus.tagId}</div>
              <div>位置：{recordFocus.location}</div>
              <div>时间：{formatDate(recordFocus.checkedAt)}</div>
              <div>检查人：{recordFocus.checkedByName}</div>
            </div>
            {(() => {
              const d = parseDetail(recordFocus.detail)
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
              onClick={() => setRecordFocus(null)}
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
