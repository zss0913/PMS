'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { normalizeTelForDial } from '@/lib/utils'

type Wo = {
  id: number
  code: string
  title: string
  type: string
  source?: string
  description: string
  status: string
  facilityScope: string | null
  feeRemark: string | null
  feeTotal: number | null
  location: string | null
  imageUrls: string[]
  completionImageUrls?: string[]
  completionRemark?: string | null
  evaluationNote?: string | null
  building: { name: string } | null
  room: { roomNumber: string; name: string } | null
  tenant: { companyName: string } | null
  reporter: { role: string; name: string; phone: string } | null
  assignedEmployee: { name: string; phone: string } | null
  createdAt: string
}

type FeePayState = {
  billId: number
  billCode: string
  feeType: string
  period: string
  dueDate: string
  accountReceivable: number
  amountDue: number
  paymentStatus: string
  remark: string | null
  pendingPayment: {
    id: number
    code: string
    paymentMethod: string
    paymentStatus: string
  } | null
}

export default function TenantWorkOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [wo, setWo] = useState<Wo | null>(null)
  const [feePay, setFeePay] = useState<FeePayState | null>(null)
  const [loading, setLoading] = useState(true)
  const [payBusy, setPayBusy] = useState(false)
  const [refusing, setRefusing] = useState(false)
  const [msg, setMsg] = useState('')
  const [evalBusy, setEvalBusy] = useState(false)
  const [evalText, setEvalText] = useState('')

  function isTenantSubmittedSource(src: string | undefined): boolean {
    if (!src) return false
    const s = src.trim()
    return s === '租客自建' || s === '租客端'
  }

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    try {
      const r = await fetch(`/api/mp/work-orders/${id}`, { credentials: 'include' })
      const j = await r.json()
      const w = (j.workOrder ?? null) as Wo | null
      setWo(w)

      if (w?.status === '待租客确认费用') {
        const pr = await fetch(`/api/mp/work-orders/${id}/fee-payment/prepare`, {
          method: 'POST',
          credentials: 'include',
        })
        const pj = await pr.json()
        if (pr.ok && pj.success && pj.data?.bill) {
          const b = pj.data.bill
          setFeePay({
            billId: b.id,
            billCode: b.code,
            feeType: b.feeType,
            period: b.period,
            dueDate: b.dueDate,
            accountReceivable: b.accountReceivable,
            amountDue: b.amountDue,
            paymentStatus: b.paymentStatus,
            remark: b.remark ?? null,
            pendingPayment: pj.data.pendingPayment ?? null,
          })
        } else {
          setFeePay(null)
          if (!pr.ok || !pj.success) {
            setMsg(pj.message || '生成费用账单失败')
          }
        }
      } else {
        setFeePay(null)
      }
    } catch {
      setWo(null)
      setFeePay(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const submitTenantEvaluation = async () => {
    if (!wo || wo.status !== '待评价') return
    setEvalBusy(true)
    setMsg('')
    try {
      const r = await fetch(`/api/mp/work-orders/${id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'submit_tenant_evaluation',
          evaluationContent: evalText.trim() || undefined,
        }),
      })
      const j = (await r.json()) as { success?: boolean; message?: string }
      if (!r.ok || !j.success) {
        setMsg(j.message || '提交失败')
        return
      }
      setEvalText('')
      await load()
    } catch {
      setMsg('网络错误')
    } finally {
      setEvalBusy(false)
    }
  }

  const checkout = async (channel: 'wechat' | 'alipay') => {
    if (!feePay) return
    setMsg('')
    setPayBusy(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}/fee-payment/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billId: feePay.billId, channel }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setMsg(j.message || '下单失败')
        return
      }
      const p = j.data.payment as {
        id: number
        code: string
        paymentMethod: string
        totalAmount: number
      }
      setFeePay((prev) =>
        prev
          ? {
              ...prev,
              pendingPayment: {
                id: p.id,
                code: p.code,
                paymentMethod: p.paymentMethod,
                paymentStatus: 'pending',
              },
            }
          : null
      )
    } catch {
      setMsg('网络错误')
    } finally {
      setPayBusy(false)
    }
  }

  const completePay = async () => {
    const pid = feePay?.pendingPayment?.id
    if (pid == null) return
    setMsg('')
    setPayBusy(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}/fee-payment/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentId: pid }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setMsg(j.message || '确认支付失败')
        return
      }
      await load()
    } catch {
      setMsg('网络错误')
    } finally {
      setPayBusy(false)
    }
  }

  const refuseFee = async () => {
    const reason = window.prompt('可选：填写拒绝原因（将记入操作日志）', '') ?? ''
    if (!window.confirm('确定拒绝付费？工单将变为「已取消」且无法继续维修。')) return
    setMsg('')
    setRefusing(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}/refuse-fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setMsg(j.message || '操作失败')
        return
      }
      await load()
    } catch {
      setMsg('网络错误')
    } finally {
      setRefusing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">加载中…</div>
    )
  }
  if (!wo) {
    return (
      <div className="p-4">
        <Link href="/m/tenant/work-orders" className="text-sm text-slate-500">
          ← 返回
        </Link>
        <p className="mt-4 text-slate-500">工单不存在</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <Link href="/m/tenant/work-orders" className="text-sm text-slate-500">
        ← 返回列表
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
          {wo.facilityScope && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">范围</dt>
              <dd>{wo.facilityScope}</dd>
            </div>
          )}
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
          <div className="flex gap-2">
            <dt className="text-slate-400 shrink-0">租客</dt>
            <dd>{wo.tenant?.companyName?.trim() ? wo.tenant.companyName : '—'}</dd>
          </div>
          {wo.reporter && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">提交人</dt>
              <dd className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-right">
                <span>
                  {wo.reporter.name}（{wo.reporter.role}）
                </span>
                {normalizeTelForDial(wo.reporter.phone) && (
                  <a
                    href={`tel:${normalizeTelForDial(wo.reporter.phone)}`}
                    className="shrink-0 rounded-full border border-sky-500/50 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400"
                  >
                    拨号
                  </a>
                )}
              </dd>
            </div>
          )}
          {wo.assignedEmployee && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">处理人</dt>
              <dd className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-right">
                <span>
                  {wo.assignedEmployee.name} {wo.assignedEmployee.phone}
                </span>
                {normalizeTelForDial(wo.assignedEmployee.phone) && (
                  <a
                    href={`tel:${normalizeTelForDial(wo.assignedEmployee.phone)}`}
                    className="shrink-0 rounded-full border border-sky-500/50 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400"
                  >
                    拨号
                  </a>
                )}
              </dd>
            </div>
          )}
          {wo.location && (
            <div className="flex gap-2">
              <dt className="text-slate-400 shrink-0">位置</dt>
              <dd>{wo.location}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-slate-400 shrink-0">创建时间</dt>
            <dd>{new Date(wo.createdAt).toLocaleString('zh-CN')}</dd>
          </div>
        </dl>

        {['待员工确认费用', '待租客确认费用'].includes(wo.status) &&
          (wo.feeRemark || (wo.feeTotal != null && Number.isFinite(wo.feeTotal))) && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm">
              {wo.feeTotal != null && Number.isFinite(wo.feeTotal) && (
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  费用合计：<span className="tabular-nums">{Number(wo.feeTotal).toFixed(2)}</span> 元
                </p>
              )}
              {wo.feeRemark && (
                <>
                  <p className="font-medium text-amber-900 dark:text-amber-200 mt-2">费用说明</p>
                  <p className="mt-1 text-amber-800 dark:text-amber-100 whitespace-pre-wrap">{wo.feeRemark}</p>
                </>
              )}
              {wo.status === '待员工确认费用' && (
                <p className="mt-3 text-amber-800 dark:text-amber-200 text-xs">
                  物业正在核对费用，核对完毕后将送您确认。
                </p>
              )}
              {wo.status === '待租客确认费用' && feePay && (
                <div className="mt-3 space-y-2 border-t border-amber-200/60 dark:border-amber-800/60 pt-3">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    须在线支付后方可继续维修。已生成账单{' '}
                    <span className="font-mono">{feePay.billCode}</span>（{feePay.feeType}，账期{' '}
                    {feePay.period}，应付 {feePay.amountDue.toFixed(2)} 元）。
                  </p>
                  {feePay.remark && (
                    <p className="text-xs text-amber-800/90 whitespace-pre-wrap line-clamp-4">
                      账单备注：{feePay.remark}
                    </p>
                  )}
                  {!feePay.pendingPayment && feePay.paymentStatus !== 'paid' && (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => void checkout('wechat')}
                        disabled={payBusy || refusing}
                        className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm disabled:opacity-50"
                      >
                        {payBusy ? '处理中…' : '微信支付'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void checkout('alipay')}
                        disabled={payBusy || refusing}
                        className="w-full py-2.5 rounded-lg bg-sky-600 text-white font-medium text-sm disabled:opacity-50"
                      >
                        {payBusy ? '处理中…' : '支付宝支付'}
                      </button>
                    </div>
                  )}
                  {feePay.pendingPayment && feePay.pendingPayment.paymentStatus === 'pending' && (
                    <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 p-2 text-xs space-y-2">
                      <p>
                        待支付缴费单：<span className="font-mono">{feePay.pendingPayment.code}</span>（
                        {feePay.pendingPayment.paymentMethod}）
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        请在微信或支付宝完成付款。接入真实收银台后，支付成功将自动确认；当前演示可在付款后点击下方按钮确认到账。
                      </p>
                      <button
                        type="button"
                        onClick={() => void completePay()}
                        disabled={payBusy || refusing}
                        className="w-full py-2.5 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50"
                      >
                        {payBusy ? '提交中…' : '我已完成支付'}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void refuseFee()}
                    disabled={payBusy || refusing}
                    className="w-full py-2.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium disabled:opacity-50"
                  >
                    {refusing ? '提交中…' : '拒绝付费（工单将取消）'}
                  </button>
                </div>
              )}
            </div>
          )}

        {(wo.completionImageUrls?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-3 bg-emerald-50/40 dark:bg-emerald-950/20">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">办结现场</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {(wo.completionImageUrls ?? []).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
                </a>
              ))}
            </div>
            {wo.completionRemark?.trim() ? (
              <p className="text-sm mt-2 text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
                {wo.completionRemark}
              </p>
            ) : null}
          </div>
        )}

        {wo.status === '待评价' && isTenantSubmittedSource(wo.source) && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-2">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              物业已办结，请提交评价（选填）以完结工单。
            </p>
            <textarea
              value={evalText}
              onChange={(e) => setEvalText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="选填：服务感受或建议"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
            <button
              type="button"
              disabled={evalBusy}
              onClick={() => void submitTenantEvaluation()}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {evalBusy ? '提交中…' : '提交评价并完结'}
            </button>
          </div>
        )}
        {wo.status === '待评价' && !isTenantSubmittedSource(wo.source) && (
          <p className="text-sm text-slate-500">
            工单已办结；本单由物业发起，评价由物业在员工端确认后即可完结。
          </p>
        )}

        {wo.evaluationNote?.trim() && wo.status === '评价完成' ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 text-sm">
            <p className="text-slate-500 mb-1">评价说明</p>
            <p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{wo.evaluationNote}</p>
          </div>
        ) : null}

        {wo.imageUrls.length > 0 && (
          <div>
            <p className="text-sm text-slate-500 mb-2">图片</p>
            <div className="flex flex-wrap gap-2">
              {wo.imageUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
                </a>
              ))}
            </div>
          </div>
        )}

        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  )
}
