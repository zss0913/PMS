'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WorkOrderFlowStepBar } from '@/components/work-orders/WorkOrderFlowStepBar'
import { normalizeTelForDial } from '@/lib/utils'
import { displayWorkOrderType } from '@/lib/work-order'

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
  evaluationStars?: number | null
  evaluationImageUrls?: string[]
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
  const [evalStars, setEvalStars] = useState(5)
  const [evalImageUrls, setEvalImageUrls] = useState<string[]>([])
  const [evalUploading, setEvalUploading] = useState(false)
  const [evalPreviewIdx, setEvalPreviewIdx] = useState<number | null>(null)
  const evalTouchStartX = useRef<number | null>(null)
  const evalFileRef = useRef<HTMLInputElement>(null)
  const MAX_EVAL_IMAGES = 10

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
      if (w?.status === '待评价' && isTenantSubmittedSource(w.source)) {
        setEvalStars(5)
        setEvalText('')
        setEvalImageUrls([])
      }

      if (w?.status === '待租客确认费用') {
        const pr = await fetch(`/api/mp/work-orders/${id}/fee-payment/prepare`, {
          method: 'POST',
          credentials: 'include',
        })
        const pj = await pr.json()
        if (pr.ok && pj.success && pj.data?.zeroFeeSkipped) {
          const r2 = await fetch(`/api/mp/work-orders/${id}`, { credentials: 'include' })
          const j2 = await r2.json()
          setWo((j2.workOrder ?? null) as Wo | null)
          setFeePay(null)
          return
        }
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

  const addEvalPhotos = useCallback(async (fileList: FileList) => {
    setEvalUploading(true)
    setMsg('')
    const uploaded: string[] = []
    try {
      for (const f of Array.from(fileList)) {
        if (uploaded.length >= MAX_EVAL_IMAGES) break
        const fd = new FormData()
        fd.set('file', f)
        const r = await fetch('/api/work-orders/upload-image', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        })
        const j = (await r.json()) as { success?: boolean; data?: { url?: string }; message?: string }
        if (!j.success || !j.data?.url) {
          setMsg(j.message || '上传失败')
          break
        }
        uploaded.push(j.data.url)
      }
      if (uploaded.length > 0) {
        setEvalImageUrls((p) => [...p, ...uploaded].slice(0, MAX_EVAL_IMAGES))
      }
    } catch {
      setMsg('上传失败')
    } finally {
      setEvalUploading(false)
    }
  }, [])

  const submitTenantEvaluation = async () => {
    if (!wo || wo.status !== '待评价') return
    if (!Number.isInteger(evalStars) || evalStars < 1 || evalStars > 5) {
      setMsg('请选择 1～5 星评价')
      return
    }
    setEvalBusy(true)
    setMsg('')
    try {
      const r = await fetch(`/api/mp/work-orders/${id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'submit_tenant_evaluation',
          evaluationStars: evalStars,
          evaluationContent: evalText.trim() || undefined,
          evaluationImages: evalImageUrls.length > 0 ? evalImageUrls : undefined,
        }),
      })
      const j = (await r.json()) as { success?: boolean; message?: string }
      if (!r.ok || !j.success) {
        setMsg(j.message || '提交失败')
        return
      }
      setEvalText('')
      setEvalStars(5)
      setEvalImageUrls([])
      await load()
    } catch {
      setMsg('网络错误')
    } finally {
      setEvalBusy(false)
    }
  }

  useEffect(() => {
    if (evalPreviewIdx === null) return
    if (evalImageUrls.length === 0) {
      setEvalPreviewIdx(null)
      return
    }
    if (evalPreviewIdx >= evalImageUrls.length) {
      setEvalPreviewIdx(evalImageUrls.length - 1)
    }
  }, [evalImageUrls.length, evalPreviewIdx])

  const checkout = async () => {
    if (!feePay) return
    setMsg('')
    setPayBusy(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}/fee-payment/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billId: feePay.billId, channel: 'wechat' }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setMsg(j.message || '下单失败')
        return
      }
      if (j.data?.mockPaymentCompleted) {
        await load()
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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">流程进度</h2>
        <WorkOrderFlowStepBar status={wo.status} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          当前及之前步骤高亮，后续为灰色（与 PC 端一致）。
        </p>
      </div>
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
            <dd>{displayWorkOrderType(wo.type)}</dd>
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
                    须通过微信支付结清账单。支付成功后工单进入「待处理」，由物业继续维修，无需再次支付。已生成账单{' '}
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
                        onClick={() => void checkout()}
                        disabled={payBusy || refusing}
                        className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm disabled:opacity-50"
                      >
                        {payBusy ? '处理中…' : '微信支付'}
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
                        请在微信内完成付款。接入真实收银台后，支付成功将自动确认；当前演示可在付款后点击下方按钮确认到账。
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

        {wo.status === '待处理' && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-sm text-emerald-900 dark:text-emerald-100">
            费用已支付，物业将继续处理本单；办结后您将收到待评价通知。本阶段无需再次支付。
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
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              物业已办结，请完成星级评价后提交以完结工单。说明与图片选填。
            </p>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">满意度（必填）</p>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEvalStars(n)}
                    className={`text-3xl leading-none px-0.5 py-0.5 rounded ${
                      n <= evalStars ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'
                    }`}
                    aria-label={`${n} 星`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-500">{evalStars} 星</span>
              </div>
            </div>
            <textarea
              value={evalText}
              onChange={(e) => setEvalText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="选填：服务感受或建议"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                评价附图（选填，最多 {MAX_EVAL_IMAGES} 张）
              </p>
              <input
                ref={evalFileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files
                  if (!files?.length) return
                  void addEvalPhotos(files).finally(() => {
                    e.target.value = ''
                  })
                }}
              />
              <div className="flex flex-wrap gap-2">
                {evalImageUrls.map((u, i) => (
                  <div key={u} className="relative h-16 w-16 shrink-0">
                    <button
                      type="button"
                      className="block h-full w-full overflow-hidden rounded-lg border border-slate-200 p-0 dark:border-slate-600"
                      onClick={() => setEvalPreviewIdx(i)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                      onClick={() => setEvalImageUrls((p) => p.filter((x) => x !== u))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {evalImageUrls.length < MAX_EVAL_IMAGES ? (
                  <button
                    type="button"
                    disabled={evalUploading || evalBusy}
                    onClick={() => evalFileRef.current?.click()}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 dark:border-slate-600"
                  >
                    {evalUploading ? '…' : '+'}
                  </button>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={evalBusy || evalUploading}
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

        {wo.status === '评价完成' &&
        (wo.evaluationStars != null ||
          wo.evaluationNote?.trim() ||
          (wo.evaluationImageUrls?.length ?? 0) > 0) ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 text-sm space-y-2">
            <p className="text-slate-500 dark:text-slate-400 font-medium">我的评价</p>
            {wo.evaluationStars != null &&
            wo.evaluationStars >= 1 &&
            wo.evaluationStars <= 5 ? (
              <p className="text-amber-500 text-lg">
                {'★'.repeat(wo.evaluationStars)}
                <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                  {wo.evaluationStars} 星
                </span>
              </p>
            ) : null}
            {wo.evaluationNote?.trim() ? (
              <p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{wo.evaluationNote}</p>
            ) : null}
            {(wo.evaluationImageUrls?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(wo.evaluationImageUrls ?? []).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
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

      {evalPreviewIdx !== null && evalImageUrls.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="评价附图预览"
          className="fixed inset-0 z-[200] flex flex-col bg-black/92"
          onClick={() => setEvalPreviewIdx(null)}
        >
          <div className="flex shrink-0 items-center justify-between px-3 py-3 text-white">
            <span className="text-sm tabular-nums">
              {evalPreviewIdx + 1} / {evalImageUrls.length}
            </span>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/30"
              onClick={(e) => {
                e.stopPropagation()
                setEvalPreviewIdx(null)
              }}
            >
              关闭
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              evalTouchStartX.current = e.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(e) => {
              const start = evalTouchStartX.current
              const end = e.changedTouches[0]?.clientX
              evalTouchStartX.current = null
              if (start == null || end == null || evalImageUrls.length < 2) return
              const d = end - start
              if (d > 50) {
                setEvalPreviewIdx(
                  (idx) =>
                    idx === null ? null : (idx - 1 + evalImageUrls.length) % evalImageUrls.length
                )
              } else if (d < -50) {
                setEvalPreviewIdx((idx) =>
                  idx === null ? null : (idx + 1) % evalImageUrls.length
                )
              }
            }}
          >
            {evalImageUrls.length > 1 ? (
              <button
                type="button"
                className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-2 py-3 text-xl text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  setEvalPreviewIdx(
                    (idx) =>
                      idx === null ? null : (idx - 1 + evalImageUrls.length) % evalImageUrls.length
                  )
                }}
                aria-label="上一张"
              >
                ‹
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={evalImageUrls[evalPreviewIdx] ?? ''}
              alt=""
              className="max-h-[min(78vh,100%)] max-w-full object-contain"
            />
            {evalImageUrls.length > 1 ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-2 py-3 text-xl text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  setEvalPreviewIdx((idx) =>
                    idx === null ? null : (idx + 1) % evalImageUrls.length
                  )
                }}
                aria-label="下一张"
              >
                ›
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
