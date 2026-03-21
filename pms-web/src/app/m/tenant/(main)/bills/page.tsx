'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Row = {
  id: number
  code: string
  ruleName: string
  period: string
  amountDue: number
  status: string
  paymentStatus: string
  dueDate: string
  room: string
  tenantName: string | null
}

export default function TenantBillsPage() {
  const [list, setList] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/mp/bills', { credentials: 'include' })
        const j = await r.json()
        setList(j.list ?? [])
      } catch {
        setList([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-semibold">我的账单</h1>
      <p className="text-xs text-slate-500">与 PC 端账单数据一致；缴费请按物业指引办理</p>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">暂无账单</p>
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li key={b.id}>
              <Link
                href={`/m/tenant/bills/${b.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{b.code}</span>
                  <span className="text-xs text-slate-500">{b.paymentStatus}</span>
                </div>
                <p className="font-medium mt-1">{b.ruleName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{b.period}</p>
                <p className="text-sm mt-2">
                  待缴 <span className="text-red-600 font-semibold">¥{b.amountDue.toFixed(2)}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {b.room} · 截止 {new Date(b.dueDate).toLocaleDateString('zh-CN')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
