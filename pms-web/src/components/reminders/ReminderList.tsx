'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Search, RotateCcw } from 'lucide-react'

type Reminder = {
  id: number
  code: string
  billIds: number[]
  billCodes: string
  method: string
  content: string | null
  status: string
  sentAt: string
  createdAt: string
}

type ApiData = {
  list: Reminder[]
}

export function ReminderList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** 筛选用：与请求参数同步，点「查询」后生效 */
  const [sentAtStart, setSentAtStart] = useState('')
  const [sentAtEnd, setSentAtEnd] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [methodContains, setMethodContains] = useState('')
  /** 已应用到请求的筛选（用于列表查询） */
  const [applied, setApplied] = useState({
    sentAtStart: '',
    sentAtEnd: '',
    tenantName: '',
    methodContains: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (applied.sentAtStart) params.set('sentAtStart', applied.sentAtStart)
      if (applied.sentAtEnd) params.set('sentAtEnd', applied.sentAtEnd)
      if (applied.tenantName.trim()) params.set('tenantName', applied.tenantName.trim())
      if (applied.methodContains.trim()) params.set('methodContains', applied.methodContains.trim())
      const q = params.toString()
      const res = await fetch(`/api/reminders${q ? `?${q}` : ''}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else setData(null)
    } catch {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const applyFilters = () => {
    setApplied({
      sentAtStart,
      sentAtEnd,
      tenantName,
      methodContains,
    })
  }

  const resetFilters = () => {
    setSentAtStart('')
    setSentAtEnd('')
    setTenantName('')
    setMethodContains('')
    setApplied({
      sentAtStart: '',
      sentAtEnd: '',
      tenantName: '',
      methodContains: '',
    })
  }

  const list = data?.list ?? []
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(list, 15)

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理催缴</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
      </div>
    )
  }

  if (loading && !data) {
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

  const formatDateTime = (s: string) => {
    try {
      const d = new Date(s)
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return s
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">催缴日期起</label>
          <input
            type="date"
            value={sentAtStart}
            onChange={(e) => setSentAtStart(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">催缴日期止</label>
          <input
            type="date"
            value={sentAtEnd}
            onChange={(e) => setSentAtEnd(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-xs">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">租客名称</label>
          <input
            type="text"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            placeholder="模糊匹配"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div className="min-w-[140px] flex-1 max-w-xs">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">催缴方式</label>
          <input
            type="text"
            value={methodContains}
            onChange={(e) => setMethodContains(e.target.value)}
            placeholder="模糊匹配，如：短信"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-white dark:bg-slate-600 hover:bg-slate-700 text-sm"
        >
          <Search className="w-4 h-4" />
          查询
        </button>
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">催缴编号</th>
              <th className="text-left p-4 font-medium">关联账单</th>
              <th className="text-left p-4 font-medium">催缴方式</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">发送时间</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{r.code}</td>
                <td className="p-4 max-w-[300px] truncate" title={r.billCodes}>{r.billCodes || '-'}</td>
                <td className="p-4">{r.method}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    r.status === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {r.status === 'success' ? '已发送' : r.status}
                  </span>
                </td>
                <td className="p-4">{formatDateTime(r.sentAt)}</td>
                <td className="p-4">
                  <Link
                    href={`/reminders/${r.id}`}
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无催缴记录，请从账单管理发起催缴
        </div>
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

    </div>
  )
}
