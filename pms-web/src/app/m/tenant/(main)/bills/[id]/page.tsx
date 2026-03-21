'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Data = {
  id: number
  code: string
  ruleName: string
  period: string
  accountReceivable: number
  amountPaid: number
  amountDue: number
  status: string
  paymentStatus: string
  dueDate: string
  tenantName: string | null
  buildingName: string | null
  room: string
  payments: { amount: number; paidAt: string | null; paymentMethod: string | null }[]
  refunds: { code: string; amount: number; reason: string; refundAt: string }[]
}

export default function TenantBillDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/mp/bills/${id}`, { credentials: 'include' })
        const j = await r.json()
        setData(j.data ?? null)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return <div className="p-8 text-center text-slate-500 text-sm">加载中…</div>
  }
  if (!data) {
    return (
      <div className="p-4">
        <Link href="/m/tenant/bills" className="text-sm text-slate-500">
          ← 返回
        </Link>
        <p className="mt-4 text-slate-500">账单不存在</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <Link href="/m/tenant/bills" className="text-sm text-slate-500">
        ← 账单列表
      </Link>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
        <p className="font-mono text-xs text-slate-500">{data.code}</p>
        <h1 className="text-lg font-semibold">{data.ruleName}</h1>
        <p className="text-sm text-slate-500">{data.period}</p>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-slate-500">应收</dt>
            <dd>¥{data.accountReceivable.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">已缴</dt>
            <dd>¥{data.amountPaid.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt className="text-slate-500">待缴</dt>
            <dd className="text-red-600">¥{data.amountDue.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{data.paymentStatus}</span>
            <span>截止 {new Date(data.dueDate).toLocaleDateString('zh-CN')}</span>
          </div>
        </dl>
        {data.buildingName && <p className="text-sm text-slate-600">楼宇：{data.buildingName}</p>}
        <p className="text-sm text-slate-600">房源：{data.room}</p>
        {data.payments.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">缴纳记录</p>
            <ul className="text-sm space-y-1 text-slate-600">
              {data.payments.map((p, i) => (
                <li key={i}>
                  ¥{p.amount.toFixed(2)}
                  {p.paidAt && ` · ${new Date(p.paidAt).toLocaleString('zh-CN')}`}
                  {p.paymentMethod && ` · ${p.paymentMethod}`}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.refunds.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">退费记录</p>
            <ul className="text-sm space-y-1 text-slate-600">
              {data.refunds.map((r) => (
                <li key={r.code}>
                  {r.code} · ¥{r.amount.toFixed(2)} · {r.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
