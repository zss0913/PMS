'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'

type Refund = {
  id: number
  code: string
  billId: number
  bill: { id: number; code: string; tenant?: { id: number; companyName: string } }
  tenant?: { id: number; companyName: string }
  refundAt: string
  refunder: string
  amount: number
  reason: string
  remark: string | null
  createdAt: string
}

type ApiData = {
  list: Refund[]
}

export function RefundList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/refunds')
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setData(null)
        setError(json.message ?? '加载失败')
      }
    } catch {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const list = data?.list ?? []
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(list, 15)

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法查看退费记录</p>
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
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">退费编号</th>
              <th className="text-left p-4 font-medium">账单</th>
              <th className="text-left p-4 font-medium">租客</th>
              <th className="text-left p-4 font-medium">退费时间</th>
              <th className="text-left p-4 font-medium">退费人</th>
              <th className="text-right p-4 font-medium">金额</th>
              <th className="text-left p-4 font-medium">原因</th>
              <th className="text-left p-4 font-medium whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{r.code}</td>
                <td className="p-4">{r.bill?.code ?? '-'}</td>
                <td className="p-4">{r.tenant?.companyName ?? r.bill?.tenant?.companyName ?? '-'}</td>
                <td className="p-4">{formatDateTime(r.refundAt)}</td>
                <td className="p-4">{r.refunder}</td>
                <td className="p-4 text-right">¥{r.amount.toFixed(2)}</td>
                <td className="p-4 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                <td className="p-4">
                  <Link
                    href={`/refunds/${r.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400 text-sm whitespace-nowrap"
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
          暂无退费记录
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
