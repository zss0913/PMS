'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type Wo = {
  id: number
  code: string
  title: string
  type: string
  description: string
  status: string
  facilityScope: string | null
  feeRemark: string | null
  location: string | null
  imageUrls: string[]
  building: { name: string } | null
  room: { roomNumber: string; name: string } | null
  tenant: { companyName: string } | null
  assignedEmployee: { name: string; phone: string } | null
  createdAt: string
}

export default function StaffWorkOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [wo, setWo] = useState<Wo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [feeRemark, setFeeRemark] = useState('')
  const [showFee, setShowFee] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}`, { credentials: 'include' })
      const j = await r.json()
      setWo(j.workOrder ?? null)
      if (j.workOrder?.feeRemark) setFeeRemark(j.workOrder.feeRemark)
    } catch {
      setWo(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const advance = async (
    action:
      | 'start_processing'
      | 'request_fee_confirmation'
      | 'complete_for_evaluation'
      | 'mark_evaluated'
      | 'cancel',
    extra?: { feeRemark?: string }
  ) => {
    setMsg('')
    setBusy(true)
    try {
      const r = await fetch(`/api/work-orders/${id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...extra }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setMsg(j.message || '操作失败')
        return
      }
      setShowFee(false)
      await load()
    } catch {
      setMsg('网络错误')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 text-sm">加载中…</div>
  }
  if (!wo) {
    return (
      <div className="p-4">
        <Link href="/m/staff/work-orders" className="text-sm text-slate-500">
          ← 返回
        </Link>
        <p className="mt-4 text-slate-500">工单不存在</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      <Link href="/m/staff/work-orders" className="text-sm text-slate-500">
        ← 列表
      </Link>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex justify-between gap-2">
          <span className="font-mono text-xs text-slate-500">{wo.code}</span>
          <span className="text-sm font-medium text-blue-600">{wo.status}</span>
        </div>
        <h1 className="text-lg font-semibold">{wo.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{wo.description}</p>
        <dl className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
          <div className="flex gap-2">
            <dt className="text-slate-400 shrink-0">类型</dt>
            <dd>{wo.type}</dd>
          </div>
          {wo.building && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">楼宇</dt>
              <dd>{wo.building.name}</dd>
            </div>
          )}
          {wo.room && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">房源</dt>
              <dd>
                {wo.room.roomNumber} · {wo.room.name}
              </dd>
            </div>
          )}
          {wo.tenant && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">租客</dt>
              <dd>{wo.tenant.companyName}</dd>
            </div>
          )}
          {wo.assignedEmployee && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">处理人</dt>
              <dd>
                {wo.assignedEmployee.name} {wo.assignedEmployee.phone}
              </dd>
            </div>
          )}
        </dl>
        {wo.imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {wo.imageUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="block w-20 h-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
              </a>
            ))}
          </div>
        )}
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>

      <div className="space-y-2">
        {wo.status === '待响应' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void advance('start_processing')}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            开始处理
          </button>
        )}
        {wo.status === '处理中' && (
          <>
            {!showFee ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowFee(true)}
                  className="flex-1 py-3 rounded-xl border border-amber-500 text-amber-800 dark:text-amber-200 font-medium"
                >
                  提交费用待确认
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void advance('complete_for_evaluation')}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50"
                >
                  办结待评价
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-sm font-medium">费用说明（选填）</p>
                <textarea
                  value={feeRemark}
                  onChange={(e) => setFeeRemark(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void advance('request_fee_confirmation', {
                      feeRemark: feeRemark.trim() || undefined,
                    })}
                    className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium"
                  >
                    确认提交
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFee(false)}
                    className="px-4 py-2.5 text-sm border rounded-lg"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {wo.status === '待评价' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void advance('mark_evaluated')}
            className="w-full py-3 rounded-xl bg-slate-800 text-white font-medium dark:bg-slate-700"
          >
            标记评价完成
          </button>
        )}
        {wo.status === '待确认费用' && (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl">
            等待租客在租客端确认费用后继续。
          </p>
        )}
        {['待派单', '待响应', '处理中'].includes(wo.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (confirm('确定取消该工单？')) void advance('cancel')
            }}
            className="w-full py-3 rounded-xl border border-red-300 text-red-600 text-sm"
          >
            取消工单
          </button>
        )}
      </div>
    </div>
  )
}
