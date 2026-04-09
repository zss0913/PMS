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
  source: string
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
  building: { id: number; name: string } | null
  room: { roomNumber: string; name: string } | null
  tenant: { id: number; companyName: string } | null
  reporter: { role: string; name: string; phone: string } | null
  assignedEmployee: { name: string; phone: string } | null
  createdAt: string
  updatedAt: string
  hasWorkOrderFeeBill?: boolean
}

export default function StaffWorkOrderDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [wo, setWo] = useState<Wo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [feeRemark, setFeeRemark] = useState('')
  const [feeTotalInput, setFeeTotalInput] = useState('')
  const [showFee, setShowFee] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [completeUrls, setCompleteUrls] = useState<string[]>([])
  const [completeRemark, setCompleteRemark] = useState('')
  const [completeUploading, setCompleteUploading] = useState(false)
  const [showEval, setShowEval] = useState(false)
  const [evalContent, setEvalContent] = useState('')
  const completeFileRef = useRef<HTMLInputElement>(null)
  /** 办结已选照片全屏预览（支持左右滑动切换） */
  const [completionPreviewIdx, setCompletionPreviewIdx] = useState<number | null>(null)
  const completionTouchStartX = useRef<number | null>(null)
  const [feeTenantOptions, setFeeTenantOptions] = useState<{ id: number; companyName: string }[]>(
    []
  )
  const [feeAssignTenantId, setFeeAssignTenantId] = useState<number | ''>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/mp/work-orders/${id}`, { credentials: 'include' })
      const j = await r.json()
      setWo(j.workOrder ?? null)
      if (j.workOrder?.feeRemark) setFeeRemark(j.workOrder.feeRemark)
      if (j.workOrder?.feeTotal != null && Number.isFinite(j.workOrder.feeTotal)) {
        setFeeTotalInput(String(j.workOrder.feeTotal))
      } else {
        setFeeTotalInput('')
      }
    } catch {
      setWo(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!wo || wo.status !== '待员工确认费用' || wo.tenant) {
      setFeeTenantOptions([])
      setFeeAssignTenantId('')
      return
    }
    const bid = wo.building?.id
    const qs = bid != null ? `?buildingId=${bid}` : ''
    void fetch(`/api/mp/tenants-brief${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: { list?: { id: number; companyName: string }[] } }) => {
        if (j.success && Array.isArray(j.data?.list)) {
          setFeeTenantOptions(j.data.list)
        } else {
          setFeeTenantOptions([])
        }
      })
      .catch(() => setFeeTenantOptions([]))
    setFeeAssignTenantId('')
  }, [wo?.id, wo?.status, wo?.tenant, wo?.building?.id, wo?.updatedAt])

  useEffect(() => {
    if (completionPreviewIdx === null) return
    if (completeUrls.length === 0) {
      setCompletionPreviewIdx(null)
      return
    }
    if (completionPreviewIdx >= completeUrls.length) {
      setCompletionPreviewIdx(completeUrls.length - 1)
    }
  }, [completeUrls.length, completionPreviewIdx])

  function isTenantSubmittedSource(src: string | undefined): boolean {
    if (!src) return false
    const s = src.trim()
    return s === '租客自建' || s === '租客端'
  }

  const uploadOneCompletion = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/work-orders/upload-image', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    })
    const j = (await r.json()) as { success?: boolean; data?: { url?: string }; message?: string }
    if (j.success && j.data?.url) return j.data.url
    throw new Error(j.message || '上传失败')
  }

  const advance = async (
    action:
      | 'start_processing'
      | 'request_fee_confirmation'
      | 'no_fee_continue'
      | 'publish_fee_for_tenant'
      | 'confirm_fee_internal_pending'
      | 'complete_for_evaluation'
      | 'mark_evaluated'
      | 'refund_fee_cancel'
      | 'cancel',
    extra?: {
      feeRemark?: string
      feeTotal?: number
      assignTenantId?: number
      completionImages?: string[]
      completionRemark?: string
      evaluationContent?: string
      refundReason?: string
    }
  ) => {
    setMsg('')
    setBusy(true)
    try {
      const body: Record<string, unknown> = { action, ...extra }
      const r = await fetch(`/api/mp/work-orders/${id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setMsg(j.message || '操作失败')
        return
      }
      setShowFee(false)
      setShowComplete(false)
      setCompleteUrls([])
      setCompleteRemark('')
      setShowEval(false)
      setEvalContent('')
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
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">流程进度</h2>
        <WorkOrderFlowStepBar status={wo.status} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          当前及之前步骤高亮，后续步骤为灰色（与 PC 端一致）。
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
              <dt className="text-slate-400 shrink-0">报单人</dt>
              <dd className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-right">
                <span>
                  {wo.reporter.role} · {wo.reporter.name} {wo.reporter.phone}
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
        {(wo.completionImageUrls?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 p-2 bg-emerald-50/50 dark:bg-emerald-950/20">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">办结照片</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {(wo.completionImageUrls ?? []).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover rounded border" />
                </a>
              ))}
            </div>
            {wo.completionRemark?.trim() ? (
              <p className="text-xs mt-1 text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
                {wo.completionRemark}
              </p>
            ) : null}
          </div>
        )}
        {wo.evaluationNote?.trim() ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap border rounded-lg p-2">
            评价：{wo.evaluationNote}
          </p>
        ) : null}
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
            {!showFee && !showComplete ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowFee(true)}
                    className="flex-1 py-3 rounded-xl border border-amber-500 text-amber-800 dark:text-amber-200 font-medium"
                  >
                  登记费用
                </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCompleteUrls([])
                      setCompleteRemark('')
                      setShowComplete(true)
                    }}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50"
                  >
                    办结待评价
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        '确认未产生任何费用？无需租客确认与支付，可继续处理直至办结。'
                      )
                    ) {
                      void advance('no_fee_continue')
                    }
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium"
                >
                  未产生任何费用
                </button>
              </div>
            ) : showComplete ? (
              <div className="space-y-2 rounded-xl border border-emerald-200 dark:border-emerald-800 p-3">
                <p className="text-xs text-slate-500">
                  至少 1 张、最多 10 张 jpg/png；点击照片可放大查看，多张时可左右滑动切换。办结说明选填。
                </p>
                <input
                  ref={completeFileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files
                    if (!files?.length) return
                    void (async () => {
                      setCompleteUploading(true)
                      setMsg('')
                      try {
                        const add = Array.from(files)
                        if (completeUrls.length + add.length > 10) {
                          setMsg('最多 10 张')
                          return
                        }
                        const next = [...completeUrls]
                        for (const f of add) {
                          next.push(await uploadOneCompletion(f))
                        }
                        setCompleteUrls(next)
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : '上传失败')
                      } finally {
                        setCompleteUploading(false)
                        e.target.value = ''
                      }
                    })()
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {completeUrls.map((u, i) => (
                    <div key={u} className="relative w-14 h-14 shrink-0">
                      <button
                        type="button"
                        className="block h-full w-full overflow-hidden rounded border border-slate-200 p-0 dark:border-slate-600"
                        onClick={() => setCompletionPreviewIdx(i)}
                        aria-label="放大查看"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-full w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                        onClick={() => setCompleteUrls((p) => p.filter((x) => x !== u))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={completeUploading || completeUrls.length >= 10}
                  onClick={() => completeFileRef.current?.click()}
                  className="w-full py-2 text-sm border rounded-lg"
                >
                  {completeUploading ? '上传中…' : '选择照片'}
                </button>
                <textarea
                  value={completeRemark}
                  onChange={(e) => setCompleteRemark(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="办结说明（选填）"
                  className="w-full rounded-lg border px-2 py-1 text-sm bg-white dark:bg-slate-950"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || completeUrls.length < 1}
                    onClick={() =>
                      void advance('complete_for_evaluation', {
                        completionImages: completeUrls,
                        completionRemark: completeRemark.trim() || undefined,
                      })
                    }
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium"
                  >
                    确认办结
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComplete(false)}
                    className="px-4 py-2.5 text-sm border rounded-lg"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  有费用须填合计 &gt; 0 与说明；无费用可填 0 或留空合计，无需说明，确认后继续处理中且无需租客确认。
                </p>
                <p className="text-sm font-medium">费用合计（元）</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={feeTotalInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, '')
                    const p = v.split('.')
                    const t =
                      p.length <= 1 ? p[0] ?? '' : `${p[0]}.${p.slice(1).join('').slice(0, 2)}`
                    setFeeTotalInput(t)
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  placeholder="无费用：0 或留空"
                />
                <p className="text-sm font-medium mt-2">费用说明（有费用时必填）</p>
                <textarea
                  value={feeRemark}
                  onChange={(e) => setFeeRemark(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  placeholder="无费用可不填"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const raw = feeTotalInput.trim().replace(/,/g, '')
                      const y = raw === '' ? 0 : parseFloat(raw)
                      if (!Number.isFinite(y) || y < 0) {
                        setMsg('费用合计须为有效数字')
                        return
                      }
                      const yuan = Math.round(y * 100) / 100
                      if (yuan === 0) {
                        void advance('no_fee_continue')
                        return
                      }
                      const t = feeRemark.trim()
                      if (!t) {
                        setMsg('产生费用时请填写费用说明')
                        return
                      }
                      void advance('request_fee_confirmation', { feeRemark: t, feeTotal: yuan })
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium"
                  >
                    确认
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
        {wo.status === '待评价' && isTenantSubmittedSource(wo.source) && (
          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl">
            本单为租客报修，须租客在租客端评价后才会完结。
          </p>
        )}
        {wo.status === '待评价' && !isTenantSubmittedSource(wo.source) && !showEval && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEvalContent('')
              setShowEval(true)
            }}
            className="w-full py-3 rounded-xl bg-slate-800 text-white font-medium dark:bg-slate-700"
          >
            标记评价完成
          </button>
        )}
        {wo.status === '待评价' && !isTenantSubmittedSource(wo.source) && showEval && (
          <div className="space-y-2 rounded-xl border border-slate-300 dark:border-slate-600 p-3">
            <p className="text-xs text-slate-500">评价内容选填</p>
            <textarea
              value={evalContent}
              onChange={(e) => setEvalContent(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border px-2 py-1 text-sm bg-white dark:bg-slate-950"
              placeholder="选填"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void advance('mark_evaluated', {
                    evaluationContent: evalContent.trim() || undefined,
                  })
                }
                className="flex-1 py-2.5 rounded-lg bg-slate-800 text-white text-sm"
              >
                确认
              </button>
              <button type="button" onClick={() => setShowEval(false)} className="px-4 py-2 text-sm border rounded-lg">
                取消
              </button>
            </div>
          </div>
        )}
        {wo.status === '待员工确认费用' && (
          <div className="space-y-2">
            <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl">
              {wo.tenant
                ? '请核对费用无误后送租客确认。'
                : '本单未关联租客：可选费用承担租客后送在线支付，或「仅内部确认」不产生账单直接进入待处理。'}
            </p>
            {!wo.tenant && feeTenantOptions.length > 0 && (
              <select
                className="w-full rounded-xl border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-sm bg-white dark:bg-slate-950"
                value={feeAssignTenantId === '' ? '' : String(feeAssignTenantId)}
                onChange={(e) => {
                  const v = e.target.value
                  setFeeAssignTenantId(v === '' ? '' : parseInt(v, 10))
                }}
              >
                <option value="">请选择费用承担租客</option>
                {feeTenantOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.companyName}
                  </option>
                ))}
              </select>
            )}
            {!wo.tenant && feeTenantOptions.length === 0 && (
              <p className="text-xs text-slate-500 px-1">
                当前无租客可选，请使用「仅内部确认」或先在系统中维护该楼宇租客。
              </p>
            )}
            <button
              type="button"
              disabled={
                busy ||
                (!wo.tenant && (feeTenantOptions.length === 0 || feeAssignTenantId === ''))
              }
              onClick={() => {
                if (!wo.tenant) {
                  if (feeTenantOptions.length === 0 || feeAssignTenantId === '') {
                    setMsg('请先选择费用承担租客，或改用仅内部确认')
                    return
                  }
                  void advance('publish_fee_for_tenant', {
                    assignTenantId: feeAssignTenantId as number,
                  })
                } else {
                  void advance('publish_fee_for_tenant')
                }
              }}
              className="w-full py-3 rounded-xl bg-amber-600 text-white font-medium disabled:opacity-50"
            >
              确认并送租客核对
            </button>
            {!wo.tenant && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      '不产生账单、无需租客支付，工单将进入「待处理」。确定？'
                    )
                  ) {
                    return
                  }
                  void advance('confirm_fee_internal_pending')
                }}
                className="w-full py-3 rounded-xl border border-slate-400 text-slate-700 dark:text-slate-200 text-sm font-medium"
              >
                仅内部确认（不产生账单）
              </button>
            )}
          </div>
        )}
        {wo.status === '待租客确认费用' && (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl">
            等待租客在租客端支付费用；支付成功后进入「待处理」。若拒绝付费，工单将取消。
          </p>
        )}
        {wo.status === '待处理' && (
          <>
            {!showComplete ? (
              <div className="space-y-2">
                <p className="text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl">
                  {wo.hasWorkOrderFeeBill === true
                    ? '租客已在线付费，请继续维修。办结后进入待评价。需关单并冲账请点「退费并取消」。'
                    : '已通过内部确认费用（无租客费用账单），请继续维修。办结后进入待评价。'}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCompleteUrls([])
                    setCompleteRemark('')
                    setShowComplete(true)
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-50"
                >
                  办结待评价
                </button>
                {wo.hasWorkOrderFeeBill === true && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt('可选：退费原因', '') ?? ''
                      if (
                        !confirm('确定退费冲账并取消工单？账单将回退已缴金额。')
                      ) {
                        return
                      }
                      void advance('refund_fee_cancel', {
                        refundReason: reason.trim() || undefined,
                      })
                    }}
                    className="w-full py-3 rounded-xl border border-red-400 text-red-600 dark:text-red-300 text-sm font-medium"
                  >
                    退费并取消工单
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-emerald-200 dark:border-emerald-800 p-3">
                <p className="text-xs text-slate-500">
                  至少 1 张、最多 10 张 jpg/png；点击照片可放大查看，多张时可左右滑动切换。办结说明选填。
                </p>
                <input
                  ref={completeFileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files
                    if (!files?.length) return
                    void (async () => {
                      setCompleteUploading(true)
                      setMsg('')
                      try {
                        const add = Array.from(files)
                        if (completeUrls.length + add.length > 10) {
                          setMsg('最多 10 张')
                          return
                        }
                        const next = [...completeUrls]
                        for (const f of add) {
                          next.push(await uploadOneCompletion(f))
                        }
                        setCompleteUrls(next)
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : '上传失败')
                      } finally {
                        setCompleteUploading(false)
                        e.target.value = ''
                      }
                    })()
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {completeUrls.map((u, i) => (
                    <div key={u} className="relative w-14 h-14 shrink-0">
                      <button
                        type="button"
                        className="block h-full w-full overflow-hidden rounded border border-slate-200 p-0 dark:border-slate-600"
                        onClick={() => setCompletionPreviewIdx(i)}
                        aria-label="放大查看"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-full w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white"
                        onClick={() => setCompleteUrls((p) => p.filter((x) => x !== u))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={completeUploading || completeUrls.length >= 10}
                  onClick={() => completeFileRef.current?.click()}
                  className="w-full py-2 text-sm border rounded-lg"
                >
                  {completeUploading ? '上传中…' : '选择照片'}
                </button>
                <textarea
                  value={completeRemark}
                  onChange={(e) => setCompleteRemark(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="办结说明（选填）"
                  className="w-full rounded-lg border px-2 py-1 text-sm bg-white dark:bg-slate-950"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || completeUrls.length < 1}
                    onClick={() =>
                      void advance('complete_for_evaluation', {
                        completionImages: completeUrls,
                        completionRemark: completeRemark.trim() || undefined,
                      })
                    }
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium"
                  >
                    确认办结
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComplete(false)}
                    className="px-4 py-2.5 text-sm border rounded-lg"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {['待派单', '待响应'].includes(wo.status) && (
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

      {completionPreviewIdx !== null && completeUrls.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="照片预览"
          className="fixed inset-0 z-[200] flex flex-col bg-black/92"
          onClick={() => setCompletionPreviewIdx(null)}
        >
          <div className="flex shrink-0 items-center justify-between px-3 py-3 text-white">
            <span className="text-sm tabular-nums">
              {completionPreviewIdx + 1} / {completeUrls.length}
            </span>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/30"
              onClick={(e) => {
                e.stopPropagation()
                setCompletionPreviewIdx(null)
              }}
            >
              关闭
            </button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              completionTouchStartX.current = e.touches[0]?.clientX ?? null
            }}
            onTouchEnd={(e) => {
              const start = completionTouchStartX.current
              const end = e.changedTouches[0]?.clientX
              completionTouchStartX.current = null
              if (start == null || end == null || completeUrls.length < 2) return
              const d = end - start
              if (d > 50) {
                setCompletionPreviewIdx(
                  (idx) =>
                    idx === null ? null : (idx - 1 + completeUrls.length) % completeUrls.length
                )
              } else if (d < -50) {
                setCompletionPreviewIdx((idx) =>
                  idx === null ? null : (idx + 1) % completeUrls.length
                )
              }
            }}
          >
            {completeUrls.length > 1 ? (
              <button
                type="button"
                className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-2 py-3 text-xl text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  setCompletionPreviewIdx(
                    (idx) =>
                      idx === null ? null : (idx - 1 + completeUrls.length) % completeUrls.length
                  )
                }}
                aria-label="上一张"
              >
                ‹
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={completeUrls[completionPreviewIdx] ?? ''}
              alt=""
              className="max-h-[min(78vh,100%)] max-w-full object-contain"
            />
            {completeUrls.length > 1 ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 px-2 py-3 text-xl text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  setCompletionPreviewIdx((idx) =>
                    idx === null ? null : (idx + 1) % completeUrls.length
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
