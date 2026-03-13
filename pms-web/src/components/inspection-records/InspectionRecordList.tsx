'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Search } from 'lucide-react'

type InspectionRecord = {
  id: number
  taskId: number
  taskCode: string
  inspectionType: string
  location: string
  checkedAt: string
  checkedByName: string
  status: string
}

type ApiData = {
  list: InspectionRecord[]
}

export function InspectionRecordList({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean
}) {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inspection-records')
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '加载失败')
        setData(null)
        return
      }
      setData(json.data)
    } catch (e) {
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
  const filtered = list.filter(
    (r) =>
      !keyword ||
      r.taskCode.includes(keyword) ||
      r.inspectionType.includes(keyword) ||
      r.location.includes(keyword) ||
      r.checkedByName.includes(keyword) ||
      r.status.includes(keyword)
  )
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

  const statusLabel: Record<string, string> = {
    normal: '正常',
    abnormal: '异常',
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索任务编号、巡检类型、位置、检查人、状态"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">记录ID</th>
              <th className="text-left p-4 font-medium">任务编号</th>
              <th className="text-left p-4 font-medium">巡检类型</th>
              <th className="text-left p-4 font-medium">位置</th>
              <th className="text-left p-4 font-medium">检查时间</th>
              <th className="text-left p-4 font-medium">检查人</th>
              <th className="text-left p-4 font-medium">状态</th>
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
                <td className="p-4">{r.inspectionType}</td>
                <td className="p-4">{r.location}</td>
                <td className="p-4">{formatDate(r.checkedAt)}</td>
                <td className="p-4">{r.checkedByName}</td>
                <td className="p-4">{statusLabel[r.status] ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无巡检记录
        </div>
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
