'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { formatDate } from '@/lib/utils'

type InspectionTask = {
  id: number
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  personnelNames: string
}

type ApiData = {
  list: InspectionTask[]
  statusOptions: string[]
}

export function InspectionTaskList() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [generating, setGenerating] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/inspection-tasks?${params}`)
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/inspection-tasks/generate', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        loadData()
        alert(`已生成 ${json.data.created} 个任务`)
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
  const statusOptions = data?.statusOptions ?? ['待执行', '执行中', '已完成', '已逾期']
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(list, 15)

  const getStatusColor = (status: string) => {
    switch (status) {
      case '待执行':
        return 'text-slate-600 dark:text-slate-400'
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
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[180px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">全部状态</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {generating ? '生成中...' : '从计划生成今日任务'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <th className="text-left p-4 font-medium">任务编号</th>
                <th className="text-left p-4 font-medium">计划名称</th>
                <th className="text-left p-4 font-medium">巡检类型</th>
                <th className="text-left p-4 font-medium">计划日期</th>
                <th className="text-left p-4 font-medium">状态</th>
                <th className="text-left p-4 font-medium">巡检人员</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : (
                paginatedItems.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="p-4 font-medium">{t.code}</td>
                    <td className="p-4">{t.planName}</td>
                    <td className="p-4">{t.inspectionType}</td>
                    <td className="p-4">{formatDate(t.scheduledDate)}</td>
                    <td className="p-4">
                      <span className={getStatusColor(t.status)}>{t.status}</span>
                    </td>
                    <td className="p-4">{t.personnelNames}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && list.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            暂无巡检任务。任务由巡检计划自动生成，请先创建巡检计划。
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
    </div>
  )
}
