'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type PreviewRow = {
  id: number
  tenantId: number
  code: string
  tenantName: string
  feeType: string
  period: string
  accountReceivable: number
  amountPaid: number
  receiptIssuedAmount: number
  remainingReceiptable: number
  dueDate: string
}

type ReceiptTemplateOpt = { id: number; name: string }

export type ReceiptMergeMode = 'byTenant' | 'perBill'

function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function ReceiptIssueForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const idsParam = searchParams.get('ids')?.trim() ?? ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [amounts, setAmounts] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [receiptTemplates, setReceiptTemplates] = useState<ReceiptTemplateOpt[]>([])
  const [templateId, setTemplateId] = useState('')
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [mergeMode, setMergeMode] = useState<ReceiptMergeMode>('byTenant')

  useEffect(() => {
    let cancelled = false
    setLoadingTemplates(true)
    fetch('/api/print-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((json: { success?: boolean; data?: unknown }) => {
        if (cancelled || !json.success) return
        const list = (Array.isArray(json.data) ? json.data : []) as {
          id: number
          name: string
          type: string
          status: string
          templateUrl?: string | null
        }[]
        const opts = list
          .filter((t) => t.type === '收据' && t.status === 'active' && t.templateUrl)
          .map((t) => ({ id: t.id, name: t.name }))
        setReceiptTemplates(opts)
        setTemplateId((prev) => {
          if (prev && opts.some((o) => String(o.id) === prev)) return prev
          return opts.length > 0 ? String(opts[0].id) : ''
        })
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!idsParam) {
      router.replace('/bills')
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/bills/receipt-issue-preview?ids=${encodeURIComponent(idsParam)}`,
          { credentials: 'include' }
        )
        const json = (await res.json()) as {
          success?: boolean
          message?: string
          data?: { list: PreviewRow[] }
        }
        if (!res.ok || !json.success || !json.data?.list) {
          setError(json.message || '加载失败')
          setRows([])
          return
        }
        if (cancelled) return
        setRows(json.data.list)
        const init: Record<number, string> = {}
        for (const r of json.data.list) {
          init[r.id] = ''
        }
        setAmounts(init)
      } catch {
        if (!cancelled) setError('网络错误')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [idsParam, router])

  const issuableRows = useMemo(
    () => rows.filter((r) => r.remainingReceiptable > 1e-6),
    [rows]
  )

  /** 列表排序：按租客合并时同一租客相邻；不合并时按账单 id */
  const sortedRows = useMemo(() => {
    const r = [...rows]
    if (mergeMode === 'byTenant') {
      r.sort((a, b) => (a.tenantId !== b.tenantId ? a.tenantId - b.tenantId : a.id - b.id))
    } else {
      r.sort((a, b) => a.id - b.id)
    }
    return r
  }, [rows, mergeMode])

  /** 按租客合并时拆成若干组，用于左侧连接线与分组间距 */
  const tenantGroups = useMemo(() => {
    if (mergeMode !== 'byTenant') return sortedRows.map((row) => [row])
    const groups: PreviewRow[][] = []
    let cur: PreviewRow[] = []
    let last: number | null = null
    for (const row of sortedRows) {
      if (last === null || row.tenantId !== last) {
        if (cur.length) groups.push(cur)
        cur = [row]
        last = row.tenantId
      } else {
        cur.push(row)
      }
    }
    if (cur.length) groups.push(cur)
    return groups
  }, [sortedRows, mergeMode])

  const clientErrors = useMemo(() => {
    const m = new Map<number, string>()
    for (const r of issuableRows) {
      const raw = amounts[r.id] ?? ''
      if (raw.trim() === '') continue
      const amt = parseAmount(raw)
      if (amt === null || amt <= 0) {
        m.set(r.id, '金额须大于 0')
        continue
      }
      if (amt > r.remainingReceiptable + 1e-6) {
        m.set(
          r.id,
          `本次开具 + 已开收据不能超过应收（最多可开 ¥${r.remainingReceiptable.toFixed(2)}）`
        )
      }
    }
    return m
  }, [issuableRows, amounts])

  const submitLineCount = useMemo(
    () =>
      issuableRows.filter((r) => {
        const a = parseAmount(amounts[r.id] ?? '')
        return a !== null && a > 0
      }).length,
    [issuableRows, amounts]
  )

  const canSubmit =
    submitLineCount > 0 &&
    clientErrors.size === 0 &&
    !submitting &&
    !loading &&
    !loadingTemplates &&
    templateId !== '' &&
    receiptTemplates.length > 0

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    const lines = issuableRows
      .filter((r) => {
        const a = parseAmount(amounts[r.id] ?? '')
        return a !== null && a > 0
      })
      .map((r) => ({
        billId: r.id,
        amount: parseAmount(amounts[r.id] ?? '')!,
      }))
    if (lines.length === 0) {
      alert('请至少填写一条账单的本次开具金额')
      return
    }
    setSubmitting(true)
    try {
      const tid = parseInt(templateId, 10)
      const res = await fetch('/api/bills/receipt-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lines,
          mergeMode,
          templateId: Number.isFinite(tid) && tid > 0 ? tid : undefined,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string }
        alert(j.message || '生成失败')
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      let name = `收据_${Date.now()}.docx`
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
      router.push('/bills')
    } finally {
      setSubmitting(false)
    }
  }, [amounts, canSubmit, issuableRows, mergeMode, router, templateId])

  const colSpan = 9

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中…
      </div>
    )
  }

  if (error || rows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <p className="text-red-600 dark:text-red-400 mb-4">{error || '没有可开具的账单'}</p>
        <Link href="/bills" className="text-blue-600 dark:text-blue-400 hover:underline">
          返回账单列表
        </Link>
      </div>
    )
  }

  if (issuableRows.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <p className="text-amber-800 dark:text-amber-200 mb-4">
          所选账单的收据开具额度均已用尽（已开收据已达应收），无法再次开具。
        </p>
        <Link href="/bills" className="text-blue-600 dark:text-blue-400 hover:underline">
          返回账单列表
        </Link>
      </div>
    )
  }

  const renderAmountCell = (r: PreviewRow) => {
    const issuable = r.remainingReceiptable > 1e-6
    if (!issuable) {
      return (
        <span className="text-slate-500 dark:text-slate-400 text-xs">已无可开余额</span>
      )
    }
    return (
      <>
        <input
          type="text"
          inputMode="decimal"
          value={amounts[r.id] ?? ''}
          onChange={(e) => setAmounts((prev) => ({ ...prev, [r.id]: e.target.value }))}
          placeholder={`≤ ${r.remainingReceiptable.toFixed(2)}`}
          className="w-full min-w-[7rem] px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-right"
        />
        {clientErrors.has(r.id) && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 text-left">
            {clientErrors.get(r.id)}
          </p>
        )}
      </>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          收据 Word 模板
        </label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={loadingTemplates || receiptTemplates.length === 0}
          className="min-w-[12rem] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm disabled:opacity-60"
        >
          {loadingTemplates ? (
            <option value="">加载模板中…</option>
          ) : receiptTemplates.length === 0 ? (
            <option value="">暂无可用收据模板</option>
          ) : (
            receiptTemplates.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))
          )}
        </select>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          开具方式
        </label>
        <select
          value={mergeMode}
          onChange={(e) => setMergeMode(e.target.value as ReceiptMergeMode)}
          className="min-w-[11rem] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
        >
          <option value="byTenant">按租客合并（同一租客一张收据）</option>
          <option value="perBill">不合并（每笔账单一张收据）</option>
        </select>
        {receiptTemplates.length === 0 && !loadingTemplates && (
          <span className="text-sm text-amber-700 dark:text-amber-300">
            请先在「财务设置 → 催缴打印模板管理」中上传并启用收据类模板。
          </span>
        )}
      </div>
      {mergeMode === 'byTenant' && (
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          同一租客的多条账单会排在一起，左侧蓝色竖线表示将合并打印在同一张收据内；未填写本次开具金额的账单不会生成收据行。
        </div>
      )}
      {mergeMode === 'perBill' && (
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          每笔填写了金额的账单各生成一张收据 Word；未填写的账单跳过。
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <th className="p-3 text-left font-medium">账单编号</th>
              <th className="p-3 text-left font-medium">租客</th>
              <th className="p-3 text-left font-medium">费用类型</th>
              <th className="p-3 text-left font-medium">账期</th>
              <th className="p-3 text-right font-medium">应收</th>
              <th className="p-3 text-right font-medium">已缴金额</th>
              <th className="p-3 text-right font-medium">已开收据</th>
              <th className="p-3 text-right font-medium">最多可开</th>
              <th className="p-3 text-right font-medium min-w-[9rem]">本次开具</th>
            </tr>
          </thead>
          {mergeMode === 'byTenant'
            ? tenantGroups.map((group, gi) => (
                <Fragment key={`g-${gi}`}>
                  <tbody>
                    {group.map((r, ri) => {
                      const linked = group.length > 1
                      return (
                        <tr
                          key={r.id}
                          className={`border-b border-slate-100 dark:border-slate-700/80 ${
                            linked
                              ? 'border-l-[3px] border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/25'
                              : ''
                          } ${linked && ri > 0 ? 'border-t border-blue-100 dark:border-blue-900/40' : ''}`}
                        >
                          <td className="p-3 font-medium">{r.code}</td>
                          <td className="p-3">{r.tenantName}</td>
                          <td className="p-3">{r.feeType}</td>
                          <td className="p-3 whitespace-nowrap">{r.period}</td>
                          <td className="p-3 text-right">¥{r.accountReceivable.toFixed(2)}</td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                            ¥{r.amountPaid.toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                            ¥{r.receiptIssuedAmount.toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                            ¥{r.remainingReceiptable.toFixed(2)}
                          </td>
                          <td className="p-3 text-right align-top">{renderAmountCell(r)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {gi < tenantGroups.length - 1 && (
                    <tbody>
                      <tr>
                        <td
                          colSpan={colSpan}
                          className="h-2 p-0 border-0 bg-slate-100/80 dark:bg-slate-900/50"
                          aria-hidden
                        />
                      </tr>
                    </tbody>
                  )}
                </Fragment>
              ))
            : (
                <tbody>
                  {sortedRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 dark:border-slate-700/80"
                    >
                      <td className="p-3 font-medium">{r.code}</td>
                      <td className="p-3">{r.tenantName}</td>
                      <td className="p-3">{r.feeType}</td>
                      <td className="p-3 whitespace-nowrap">{r.period}</td>
                      <td className="p-3 text-right">¥{r.accountReceivable.toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                        ¥{r.amountPaid.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                        ¥{r.receiptIssuedAmount.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                        ¥{r.remainingReceiptable.toFixed(2)}
                      </td>
                      <td className="p-3 text-right align-top">{renderAmountCell(r)}</td>
                    </tr>
                  ))}
                </tbody>
              )}
        </table>
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? '生成中…' : '生成并下载收据'}
        </button>
        <Link
          href="/bills"
          className="text-slate-600 dark:text-slate-400 hover:underline text-sm"
        >
          取消
        </Link>
      </div>
    </div>
  )
}
