'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Search } from 'lucide-react'

type TemplateOpt = { id: number; name: string }

const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: '未缴纳' },
  { value: 'partial', label: '部分缴纳' },
  { value: 'paid', label: '已结清' },
] as const

export type DunningDrawerInitialFilters = {
  buildingId: string
  tenantId: string
  status: string
  paymentStatus: string
  overdue: string
}

export function DunningExportDrawer({
  open,
  onClose,
  buildings,
  tenants,
  initialFilters,
}: {
  open: boolean
  onClose: () => void
  buildings: { id: number; name: string }[]
  tenants: { id: number; companyName: string }[]
  initialFilters: DunningDrawerInitialFilters
}) {
  const [buildingId, setBuildingId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [status, setStatus] = useState('')
  /** 空数组表示「全部」；否则为所选结清状态（可多选） */
  const [paymentStatuses, setPaymentStatuses] = useState<string[]>([])
  const [overdue, setOverdue] = useState(false)
  const [dueDateStart, setDueDateStart] = useState('')
  const [dueDateEnd, setDueDateEnd] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState<TemplateOpt[]>([])
  const [preview, setPreview] = useState<{ billCount: number; tenantCount: number } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setBuildingId(initialFilters.buildingId)
    setTenantId(initialFilters.tenantId)
    setStatus(initialFilters.status)
    const ps = initialFilters.paymentStatus?.trim()
    setPaymentStatuses(ps ? ps.split(',').map((s) => s.trim()).filter(Boolean) : [])
    setOverdue(initialFilters.overdue === 'true')
    setDueDateStart('')
    setDueDateEnd('')
    setPreview(null)
    setError('')
  }, [open, initialFilters])

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
    if (tenantId) params.set('tenantId', tenantId)
    if (status) params.set('status', status)
    if (paymentStatuses.length > 0) params.set('paymentStatus', paymentStatuses.join(','))
    if (overdue) params.set('overdue', 'true')
    if (dueDateStart) params.set('dueDateStart', dueDateStart)
    if (dueDateEnd) params.set('dueDateEnd', dueDateEnd)
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
    if (!templateId) {
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
          templateId: Number(templateId),
          buildingId: buildingId || undefined,
          tenantId: tenantId || undefined,
          status: status || undefined,
          paymentStatus: paymentStatuses.length > 0 ? paymentStatuses.join(',') : undefined,
          overdue: overdue ? 'true' : undefined,
          dueDateStart: dueDateStart || undefined,
          dueDateEnd: dueDateEnd || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { message?: string }).message || '生成失败')
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      let name = `催缴单_${Date.now()}.docx`
      const m = cd?.match(/filename\*=UTF-8''(.+)/)
      if (m) {
        try {
          name = decodeURIComponent(m[1].replace(/;$/, '').trim())
        } catch {
          /* ignore */
        }
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      URL.revokeObjectURL(a.href)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
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
            按条件筛选账单，同一租客合并为一份催缴内容；多个租客将合并为一个 Word（分页）。
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
            <label className="block text-xs font-medium text-slate-500 mb-1">租客</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">全部租客</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.companyName}
                </option>
              ))}
            </select>
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
            <label className="block text-xs font-medium text-slate-500 mb-1">催缴单模板 *</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={loadingTemplates}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
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
            disabled={submitting || !templateId || templates.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '生成中…' : '生成并下载 Word'}
          </button>
        </div>
      </aside>
    </>
  )
}
