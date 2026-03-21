'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Search, RotateCcw, Ban } from 'lucide-react'

const RETURN_TO_RECEIPT_RECORDS = '/receipt-records'

type LineDetail = {
  billId: number
  code: string
  lineAmount: number
  accountReceivable: number
  amountPaid: number
  amountDue: number
  receiptIssuedTotal: number
  feeType: string
  dueDate: string
}

type Row = {
  id: number
  batchId: string
  tenantName: string
  mergeMode: 'byTenant' | 'perBill'
  billCount: number
  totalAmount: number
  billCodesJson: string
  lineAmountsJson: string
  lines?: LineDetail[]
  operatorName: string | null
  operatorPhone: string | null
  createdAt: string
}

const MERGE_LABEL: Record<string, string> = {
  byTenant: '按租客合并',
  perBill: '不合并（逐账单）',
}

const PAGE_SIZE_OPTIONS = [15, 30, 100] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

export function ReceiptRecordList() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSizeOption>(15)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [voiding, setVoiding] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  /** 表单中的条件 */
  const [issuedFrom, setIssuedFrom] = useState('')
  const [issuedTo, setIssuedTo] = useState('')
  const [tenantKeyword, setTenantKeyword] = useState('')
  /** 已应用到查询的条件（点「查询」后生效） */
  const [applied, setApplied] = useState({
    issuedFrom: '',
    issuedTo: '',
    tenantKeyword: '',
  })

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (applied.issuedFrom) params.set('issuedFrom', applied.issuedFrom)
      if (applied.issuedTo) params.set('issuedTo', applied.issuedTo)
      if (applied.tenantKeyword.trim()) params.set('tenantKeyword', applied.tenantKeyword.trim())
      const res = await fetch(`/api/receipt-issue-records?${params.toString()}`, {
        credentials: 'include',
      })
      const json = (await res.json()) as {
        success?: boolean
        message?: string
        notice?: string
        data?: { list: Row[]; total: number }
      }
      if (!res.ok || !json.success || !json.data) {
        setError(json.message || '加载失败')
        setList([])
        return
      }
      setList(json.data.list)
      setTotal(json.data.total)
      if (json.notice === 'receipt_delegate_missing') {
        setNotice(
          '收据记录功能需要最新数据库客户端：请停止开发服务后执行 pnpm exec prisma generate，再重启。当前列表为空。'
        )
      } else if (json.notice === 'receipt_query_failed') {
        setNotice(
          '无法读取收据记录表。请在 pms-web 目录执行 pnpm exec prisma db push 同步数据库；若已执行过仍出现本提示，请先停止开发服务（pnpm dev），再执行 pnpm exec prisma generate，然后重新启动。'
        )
      }
    } catch {
      setError('网络错误')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, applied])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    if (total <= 0) return
    const maxPage = Math.max(1, Math.ceil(total / pageSize))
    if (page > maxPage) setPage(maxPage)
  }, [total, pageSize, page])

  const handleQuery = () => {
    setApplied({
      issuedFrom,
      issuedTo,
      tenantKeyword,
    })
    setPage(1)
  }

  const handleReset = () => {
    setIssuedFrom('')
    setIssuedTo('')
    setTenantKeyword('')
    setApplied({ issuedFrom: '', issuedTo: '', tenantKeyword: '' })
    setPage(1)
    setSelected(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pageIds = list.map((r) => r.id)
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  const toggleSelectAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        for (const id of pageIds) next.delete(id)
      } else {
        for (const id of pageIds) next.add(id)
      }
      return next
    })
  }

  const handleBatchVoid = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const ok = window.confirm(
      `确定作废已选的 ${ids.length} 条收据记录？作废后对应金额将从各账单的「已开收据」中冲回，且不可恢复。`
    )
    if (!ok) return
    setVoiding(true)
    setBatchError(null)
    try {
      const res = await fetch('/api/receipt-issue-records/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      })
      const json = (await res.json()) as { success?: boolean; message?: string }
      if (!res.ok || !json.success) {
        setBatchError(json.message || '作废失败')
        return
      }
      setSelected(new Set())
      await fetchList()
    } catch {
      setBatchError('网络错误')
    } finally {
      setVoiding(false)
    }
  }

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function linesForRow(r: Row): LineDetail[] {
    if (r.lines && r.lines.length > 0) return r.lines
    try {
      const a = JSON.parse(r.lineAmountsJson) as unknown
      if (!Array.isArray(a)) return []
      return a
        .map((x) => {
          if (typeof x !== 'object' || x === null) return null
          const o = x as Record<string, unknown>
          const billId = Number(o.billId)
          const code = String(o.code ?? '')
          const amount = Number(o.amount)
          if (!Number.isFinite(billId) || !Number.isFinite(amount)) return null
          const ar = Number(o.accountReceivable)
          const paid = Number(o.amountPaid)
          const due = Number(o.amountDue)
          const rec = Number(o.receiptIssuedTotalAfter)
          return {
            billId,
            code,
            lineAmount: amount,
            accountReceivable: Number.isFinite(ar) ? ar : 0,
            amountPaid: Number.isFinite(paid) ? paid : 0,
            amountDue: Number.isFinite(due) ? due : 0,
            receiptIssuedTotal: Number.isFinite(rec) ? rec : 0,
            feeType: typeof o.feeType === 'string' ? o.feeType : '—',
            dueDate: typeof o.dueDate === 'string' ? o.dueDate : '—',
          } satisfies LineDetail
        })
        .filter((x): x is LineDetail => x !== null)
    } catch {
      return []
    }
  }

  if (loading && list.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-red-600">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {notice && (
        <div className="px-4 py-3 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50">
          {notice}
        </div>
      )}
      {batchError && (
        <div className="px-4 py-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
          {batchError}
        </div>
      )}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">开具时间起</label>
          <input
            type="date"
            value={issuedFrom}
            onChange={(e) => setIssuedFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">开具时间止</label>
          <input
            type="date"
            value={issuedTo}
            onChange={(e) => setIssuedTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <div className="min-w-[12rem]">
          <label className="block text-xs text-slate-500 mb-1">租客名称</label>
          <input
            type="search"
            placeholder="模糊查询"
            value={tenantKeyword}
            onChange={(e) => setTenantKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuery()
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleQuery}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          查询
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
        <div className="flex-1 min-w-[8rem]" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            已选 {selected.size} 条
          </span>
          <button
            type="button"
            onClick={handleBatchVoid}
            disabled={loading || voiding || selected.size === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm hover:bg-red-100 dark:hover:bg-red-950/60 disabled:opacity-50"
          >
            <Ban className="w-4 h-4" />
            {voiding ? '作废中…' : '批量作废收据'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPage}
                  disabled={loading || list.length === 0}
                  className="rounded border-slate-300 dark:border-slate-600"
                  title="全选本页"
                />
              </th>
              <th className="p-3 text-left font-medium whitespace-nowrap">开具时间</th>
              <th className="p-3 text-left font-medium">租客</th>
              <th className="p-3 text-left font-medium whitespace-nowrap">开具方式</th>
              <th className="p-3 text-right font-medium">账单数</th>
              <th className="p-3 text-right font-medium">本次收据合计</th>
              <th className="p-3 text-left font-medium">操作人</th>
              <th className="p-3 text-left font-medium w-24">明细</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  暂无收据记录
                </td>
              </tr>
            ) : (
              list.flatMap((r) => {
                const lines = linesForRow(r)
                const open = expanded.has(r.id)
                const main = (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/80">
                    <td className="p-3 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {r.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="p-3 font-medium">{r.tenantName}</td>
                    <td className="p-3">{MERGE_LABEL[r.mergeMode] ?? r.mergeMode}</td>
                    <td className="p-3 text-right">{r.billCount}</td>
                    <td className="p-3 text-right">¥{r.totalAmount.toFixed(2)}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {r.operatorName ?? '-'}
                      {r.operatorPhone ? (
                        <span className="text-xs block text-slate-500">{r.operatorPhone}</span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(r.id)}
                        className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-0.5"
                      >
                        {open ? (
                          <>
                            收起 <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            展开 <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                )
                if (!open || lines.length === 0) return [main]
                const detail = (
                  <tr key={`${r.id}-detail`} className="bg-slate-50 dark:bg-slate-900/40">
                    <td colSpan={8} className="p-3 text-xs">
                      <div className="font-medium text-slate-600 dark:text-slate-400 mb-2">
                        同一批次 ID：{r.batchId.slice(0, 8)}…
                      </div>
                      <div className="overflow-x-auto max-w-full">
                        <table className="w-full min-w-[56rem] text-xs border border-slate-200 dark:border-slate-600 rounded">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800">
                              <th className="p-2 text-left whitespace-nowrap">账单编号</th>
                              <th className="p-2 text-left whitespace-nowrap">费用类型</th>
                              <th className="p-2 text-right whitespace-nowrap">应收金额</th>
                              <th className="p-2 text-right whitespace-nowrap">已缴纳金额</th>
                              <th className="p-2 text-right whitespace-nowrap">未缴纳金额</th>
                              <th className="p-2 text-right whitespace-nowrap">已开收据（开具后累计）</th>
                              <th className="p-2 text-right whitespace-nowrap">本次开具金额</th>
                              <th className="p-2 text-left whitespace-nowrap">应收日期</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((ln) => (
                              <tr key={ln.billId}>
                                <td className="p-2 border-t border-slate-200 dark:border-slate-700 font-mono">
                                  <Link
                                    href={`/bills/${ln.billId}?returnTo=${encodeURIComponent(RETURN_TO_RECEIPT_RECORDS)}`}
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    {ln.code}
                                  </Link>
                                </td>
                                <td className="p-2 border-t border-slate-200 dark:border-slate-700">
                                  {ln.feeType}
                                </td>
                                <td className="p-2 text-right border-t border-slate-200 dark:border-slate-700">
                                  ¥{ln.accountReceivable.toFixed(2)}
                                </td>
                                <td className="p-2 text-right border-t border-slate-200 dark:border-slate-700">
                                  ¥{ln.amountPaid.toFixed(2)}
                                </td>
                                <td className="p-2 text-right border-t border-slate-200 dark:border-slate-700">
                                  ¥{ln.amountDue.toFixed(2)}
                                </td>
                                <td className="p-2 text-right border-t border-slate-200 dark:border-slate-700">
                                  ¥{ln.receiptIssuedTotal.toFixed(2)}
                                </td>
                                <td className="p-2 text-right border-t border-slate-200 dark:border-slate-700 font-medium">
                                  ¥{ln.lineAmount.toFixed(2)}
                                </td>
                                <td className="p-2 border-t border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                  {ln.dueDate}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )
                return [main, detail]
              })
            )}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            共 {total} 条（每张收据一条）
          </span>
          <div className="flex items-center gap-2">
            <label htmlFor="receipt-page-size" className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
              每页
            </label>
            <select
              id="receipt-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSizeOption)
                setPage(1)
              }}
              disabled={loading}
              className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm disabled:opacity-50"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} 条
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 min-w-[12rem]">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              上一页
            </button>
            <span className="text-slate-600 dark:text-slate-300 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
