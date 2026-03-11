'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

type Payment = {
  id: number
  code: string
  tenantId: number
  tenant?: { id: number; companyName: string }
  paidAt: string
  payer: string
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
  billCount: number
  createdAt: string
}

type ApiData = {
  list: Payment[]
  tenants: { id: number; companyName: string }[]
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  success: '成功',
  failed: '失败',
}

export function PaymentList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    tenantId: '',
    startDate: '',
    endDate: '',
  })

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.tenantId) params.set('tenantId', filters.tenantId)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      const res = await fetch(`/api/payments?${params}`)
      const json = await res.json()
      if (json.success) setData(json.data)
      else setData(null)
    } catch {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filters.tenantId, filters.startDate, filters.endDate])

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法查看缴纳记录</p>
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

  const list = data?.list ?? []
  const tenants = data?.tenants ?? []

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
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <select
            value={filters.tenantId}
            onChange={(e) => setFilters((p) => ({ ...p, tenantId: e.target.value }))}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">全部租客</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.companyName}</option>
            ))}
          </select>
        </div>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          placeholder="开始日期"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          placeholder="结束日期"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">缴纳编号</th>
              <th className="text-left p-4 font-medium">租客</th>
              <th className="text-left p-4 font-medium">缴纳时间</th>
              <th className="text-left p-4 font-medium">缴纳人</th>
              <th className="text-right p-4 font-medium">总额</th>
              <th className="text-left p-4 font-medium">支付方式</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">关联账单数</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr
                key={p.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{p.code}</td>
                <td className="p-4">{p.tenant?.companyName ?? '-'}</td>
                <td className="p-4">{formatDateTime(p.paidAt)}</td>
                <td className="p-4">{p.payer}</td>
                <td className="p-4 text-right">¥{p.totalAmount.toFixed(2)}</td>
                <td className="p-4">{p.paymentMethod}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    p.paymentStatus === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {PAYMENT_STATUS_LABELS[p.paymentStatus] ?? p.paymentStatus}
                  </span>
                </td>
                <td className="p-4">{p.billCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无缴纳记录
        </div>
      )}
    </div>
  )
}
