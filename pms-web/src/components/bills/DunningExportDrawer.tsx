'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, FileText, Search, CheckCircle2 } from 'lucide-react'
import { DateRangeField } from '@/components/ui/DateRangeField'

type TemplateOpt = { id: number; name: string }

const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: '未缴纳' },
  { value: 'partial', label: '部分缴纳' },
  { value: 'paid', label: '已结清' },
] as const

export type DunningDrawerInitialFilters = {
  buildingId: string
  tenantKeyword: string
  status: string
  paymentStatus: string
  overdue: string
  feeTypeKeyword: string
  dueDateStart: string
  dueDateEnd: string
  periodStart: string
  periodEnd: string
}

type DunningApiData = {
  paperWord?: { base64: string; filename: string } | null
  sms?: { targetCount: number; note: string } | null
  app?: { messagesCreated: number } | null
}

/** 成功提示副文案：根据勾选与接口返回拼一句说明 */
function buildDunningSuccessDetail(
  data: DunningApiData | undefined,
  sendSms: boolean,
  sendApp: boolean,
  generatePaperWord: boolean
): string | undefined {
  if (!data) return undefined
  const parts: string[] = []
  if (sendSms && data.sms) {
    parts.push(`短信催缴已登记（${data.sms.targetCount} 个管理员号码）`)
  }
  if (sendApp && data.app) {
    parts.push(`应用内通知 ${data.app.messagesCreated} 条`)
  }
  if (generatePaperWord) {
    parts.push(data.paperWord ? '纸质催缴单已开始下载' : '纸质催缴单已处理')
  }
  if (parts.length === 0) return undefined
  return parts.join('；')
}

export function DunningExportDrawer({
  open,
  onClose,
  buildings,
  initialFilters,
}: {
  open: boolean
  onClose: () => void
  buildings: { id: number; name: string }[]
  initialFilters: DunningDrawerInitialFilters
}) {
  const [buildingId, setBuildingId] = useState('')
  const [tenantKeyword, setTenantKeyword] = useState('')
  const [feeTypeKeyword, setFeeTypeKeyword] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [status, setStatus] = useState('')
  /** 空数组表示「全部」；否则为所选结清状态（可多选） */
  const [paymentStatuses, setPaymentStatuses] = useState<string[]>([])
  const [overdue, setOverdue] = useState(false)
  const [dueDateStart, setDueDateStart] = useState('')
  const [dueDateEnd, setDueDateEnd] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState<TemplateOpt[]>([])
  /** 是否短信催缴（默认不勾选） */
  const [sendSms, setSendSms] = useState(false)
  /** 是否应用内催缴（默认不勾选） */
  const [sendApp, setSendApp] = useState(false)
  /** 是否生成纸质 Word（默认勾选） */
  const [generatePaperWord, setGeneratePaperWord] = useState(true)
  const [preview, setPreview] = useState<{ billCount: number; tenantCount: number } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  /** 提交成功后顶部提示（抽屉关闭后仍展示） */
  const [successToast, setSuccessToast] = useState<{ title: string; detail?: string } | null>(null)
  const [toastMounted, setToastMounted] = useState(false)

  useEffect(() => {
    if (!open) return
    setBuildingId(initialFilters.buildingId)
    setTenantKeyword(initialFilters.tenantKeyword)
    setFeeTypeKeyword(initialFilters.feeTypeKeyword)
    setPeriodStart(initialFilters.periodStart)
    setPeriodEnd(initialFilters.periodEnd)
    setStatus(initialFilters.status)
    const ps = initialFilters.paymentStatus?.trim()
    setPaymentStatuses(ps ? ps.split(',').map((s) => s.trim()).filter(Boolean) : [])
    setOverdue(initialFilters.overdue === 'true')
    setDueDateStart(initialFilters.dueDateStart)
    setDueDateEnd(initialFilters.dueDateEnd)
    setPreview(null)
    setError('')
    setSendSms(false)
    setSendApp(false)
    setGeneratePaperWord(true)
  }, [open, initialFilters])

  useEffect(() => {
    setToastMounted(true)
  }, [])

  useEffect(() => {
    if (open) setSuccessToast(null)
  }, [open])

  useEffect(() => {
    if (!successToast) return
    const t = window.setTimeout(() => setSuccessToast(null), 4500)
    return () => window.clearTimeout(t)
  }, [successToast])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingTemplates(true)
    fetch('/api/print-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return
        const list = (Array.isArray(json.data) ? json.data : []) as {
          id: number
          name: string
          type: string
          status: string
          templateUrl?: string
        }[]
        const opts = list
          .filter((t) => t.type === '催缴单' && t.status === 'active' && t.templateUrl)
          .map((t) => ({ id: t.id, name: t.name }))
        setTemplates(opts)
        if (opts.length > 0) {
          setTemplateId(String(opts[0].id))
        } else {
          setTemplateId('')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const buildQueryParams = () => {
    const params = new URLSearchParams()
    if (buildingId) params.set('buildingId', buildingId)
    if (tenantKeyword.trim()) params.set('tenantKeyword', tenantKeyword.trim())
    if (feeTypeKeyword.trim()) params.set('feeTypeKeyword', feeTypeKeyword.trim())
    if (status) params.set('status', status)
    if (paymentStatuses.length > 0) params.set('paymentStatus', paymentStatuses.join(','))
    if (overdue) params.set('overdue', 'true')
    if (dueDateStart) params.set('dueDateStart', dueDateStart)
    if (dueDateEnd) params.set('dueDateEnd', dueDateEnd)
    if (periodStart) params.set('periodStart', periodStart)
    if (periodEnd) params.set('periodEnd', periodEnd)
    return params
  }

  const runPreview = async () => {
    setError('')
    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/bills/count-summary?${buildQueryParams()}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data) {
        setPreview({
          billCount: json.data.billCount,
          tenantCount: json.data.tenantCount,
        })
      } else {
        setPreview(null)
        setError(json.message || '统计失败')
      }
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleGenerate = async () => {
    if (!sendSms && !sendApp && !generatePaperWord) {
      setError('请至少选择一种催缴方式')
      return
    }
    if (generatePaperWord && !templateId) {
      setError('请选择催缴单模板')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/bills/dunning-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sendSms,
          sendApp,
          generatePaperWord,
          templateId: generatePaperWord && templateId ? Number(templateId) : undefined,
          buildingId: buildingId || undefined,
          tenantKeyword: tenantKeyword.trim() || undefined,
          feeTypeKeyword: feeTypeKeyword.trim() || undefined,
          status: status || undefined,
          paymentStatus: paymentStatuses.length > 0 ? paymentStatuses.join(',') : undefined,
          overdue: overdue ? 'true' : undefined,
          dueDateStart: dueDateStart || undefined,
          dueDateEnd: dueDateEnd || undefined,
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        success?: boolean
        message?: string
        data?: DunningApiData
      }
      if (!res.ok || !j.success) {
        setError(j.message || '提交失败')
        return
      }
      const paper = j.data?.paperWord
      if (paper?.base64 && paper.filename) {
        const bin = atob(paper.base64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = paper.filename
        a.click()
        URL.revokeObjectURL(a.href)
      }
      const detail = buildDunningSuccessDetail(j.data, sendSms, sendApp, generatePaperWord)
      setSuccessToast({ title: '提交成功', detail })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {toastMounted &&
        successToast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed top-4 left-1/2 z-[100] flex max-w-md -translate-x-1/2 flex-col gap-1 rounded-lg border border-emerald-500/30 bg-emerald-600 px-4 py-3 text-white shadow-lg dark:bg-emerald-700"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">{successToast.title}</p>
                {successToast.detail ? (
                  <p className="mt-1 text-sm text-emerald-50/95">{successToast.detail}</p>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}
      {open && (
        <>
      <div
        role="presentation"
        className="fixed inset-0 z-[54] bg-black/40"
        onClick={onClose}
      />
      <aside
        className="fixed left-0 top-0 z-[55] h-full w-full max-w-md flex flex-col bg-white dark:bg-slate-800 shadow-2xl border-r border-slate-200 dark:border-slate-700"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">生成催缴单</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-slate-500">
            按条件筛选账单；同一租客合并为一份催缴内容。勾选「纸质催缴单」时，多个租客将合并为一个 Word（分页）并下载。
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">楼宇</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部楼宇</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">租客（模糊）</label>
            <input
              type="search"
              placeholder="公司名称关键词"
              value={tenantKeyword}
              onChange={(e) => setTenantKeyword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">费用类型（模糊）</label>
            <input
              type="search"
              placeholder="可选"
              value={feeTypeKeyword}
              onChange={(e) => setFeeTypeKeyword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">应收日期起</label>
              <input
                type="date"
                value={dueDateStart}
                onChange={(e) => setDueDateStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">应收日期止</label>
              <input
                type="date"
                value={dueDateEnd}
                onChange={(e) => setDueDateEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              />
            </div>
          </div>

          <DateRangeField
            label="账期重叠（与账单账期区间有交集即纳入）"
            start={periodStart}
            end={periodEnd}
            onChange={({ start, end }) => {
              setPeriodStart(start)
              setPeriodEnd(end)
            }}
            hint="与账单账期（起～止）有任意一天重叠即纳入；需同时填写起止。"
          />

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">账单状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部</option>
              <option value="open">开启</option>
              <option value="closed">关闭</option>
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 mb-2">结清状态（可多选）</span>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm">
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentStatuses.includes(opt.value)}
                    onChange={(e) => {
                      setPaymentStatuses((prev) => {
                        if (e.target.checked) return [...prev, opt.value]
                        return prev.filter((v) => v !== opt.value)
                      })
                    }}
                    className="rounded"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">不勾选表示全部结清状态</p>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={overdue}
              onChange={(e) => setOverdue(e.target.checked)}
              className="rounded"
            />
            仅逾期（未结清且应收日早于今天）
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              催缴单模板{generatePaperWord ? ' *' : ''}
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loadingTemplates || !generatePaperWord}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm disabled:opacity-60"
            >
              {templates.length === 0 ? (
                <option value="">暂无可用模板，请先到「催缴打印模板管理」上传</option>
              ) : (
                templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
            {!generatePaperWord && (
              <p className="text-xs text-slate-400 mt-1">未勾选纸质催缴单时可不选模板</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={loadingPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {loadingPreview ? '统计中…' : '查询数量'}
            </button>
          </div>

          {preview !== null && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm">
              <p>
                符合条件的账单 <span className="font-semibold text-blue-600">{preview.billCount}</span> 条，涉及租客{' '}
                <span className="font-semibold text-blue-600">{preview.tenantCount}</span> 家
              </p>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-600">
            <span className="block text-xs font-medium text-slate-500">催缴方式</span>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
                className="rounded"
              />
              是否进行短信催缴（向租客管理员手机号发送，需对接短信网关）
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sendApp}
                onChange={(e) => setSendApp(e.target.checked)}
                className="rounded"
              />
              是否应用内催缴（向该租客管理员账号推送站内消息）
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={generatePaperWord}
                onChange={(e) => setGeneratePaperWord(e.target.checked)}
                className="rounded"
              />
              是否生成纸质催缴单（合并为 Word 并下载）
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={
              submitting ||
              (!sendSms && !sendApp && !generatePaperWord) ||
              (generatePaperWord && (!templateId || templates.length === 0))
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中…' : '提交'}
          </button>
        </div>
      </aside>
        </>
      )}
    </>
  )
}
