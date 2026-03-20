import type { ReactNode } from 'react'
import Link from 'next/link'
import type { BillActivityLogDTO } from '@/lib/bill-activity-log-db'

type ChangeEntry = { field: string; label: string; from: string; to: string }

function parseChanges(json: string | null): ChangeEntry[] {
  if (!json?.trim()) return []
  try {
    const v = JSON.parse(json) as unknown
    return Array.isArray(v) ? (v as ChangeEntry[]) : []
  } catch {
    return []
  }
}

function parseMeta(json: string | null): Record<string, unknown> | null {
  if (!json?.trim()) return null
  try {
    const v = JSON.parse(json) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const linkCls = 'text-blue-600 hover:underline dark:text-blue-400 font-mono text-xs'

export function BillLogDescriptionCell({
  log,
  billId,
}: {
  log: BillActivityLogDTO
  billId: number
}) {
  const changes = parseChanges(log.changesJson)
  const meta = parseMeta(log.metaJson)
  const rt = encodeURIComponent(`/bills/${billId}`)

  let head: ReactNode = null

  if (log.action === 'payment' && meta && meta.paymentId != null) {
    const pid = Number(meta.paymentId)
    const code = String(meta.paymentCode ?? '')
    const amt =
      meta.allocatedAmount != null && meta.allocatedAmount !== ''
        ? Number(meta.allocatedAmount)
        : NaN
    const method =
      meta.paymentMethod != null && meta.paymentMethod !== ''
        ? String(meta.paymentMethod)
        : ''
    if (Number.isFinite(pid)) {
      head = (
        <div className="space-y-1 mb-1">
          <p className="text-slate-800 dark:text-slate-200">
            线下缴费入账 · 缴费单{' '}
            <Link href={`/payments/${pid}?returnTo=${rt}`} className={linkCls}>
              {code}
            </Link>
          </p>
          {Number.isFinite(amt) && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              本次入账金额：¥{amt.toFixed(2)}
              {method ? ` · 支付方式：${method}` : ''}
            </p>
          )}
        </div>
      )
    }
  } else if (log.action === 'refund' && meta && meta.refundId != null) {
    const rid = Number(meta.refundId)
    const code = String(meta.refundCode ?? '')
    const amt =
      meta.amount != null && meta.amount !== '' ? Number(meta.amount) : NaN
    const reason =
      meta.reason != null && meta.reason !== '' ? String(meta.reason) : ''
    const refunder =
      meta.refunder != null && meta.refunder !== '' ? String(meta.refunder) : ''
    if (Number.isFinite(rid)) {
      head = (
        <div className="space-y-1 mb-1">
          <p className="text-slate-800 dark:text-slate-200">
            退费 · 退费单{' '}
            <Link href={`/refunds/${rid}?returnTo=${rt}`} className={linkCls}>
              {code}
            </Link>
          </p>
          {Number.isFinite(amt) && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              退费金额：¥{amt.toFixed(2)}
            </p>
          )}
          {reason ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">原因：{reason}</p>
          ) : null}
          {refunder ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">退费人：{refunder}</p>
          ) : null}
        </div>
      )
    }
  } else if (log.action === 'receipt_export' && meta) {
    const line =
      meta.receiptLineAmount != null && meta.receiptLineAmount !== ''
        ? Number(meta.receiptLineAmount)
        : NaN
    const after =
      meta.receiptIssuedTotalAfter != null && meta.receiptIssuedTotalAfter !== ''
        ? Number(meta.receiptIssuedTotalAfter)
        : NaN
    const hasDetail = Number.isFinite(line) || Number.isFinite(after)
    head = (
      <div className="space-y-1 mb-1">
        <p className="text-slate-800 dark:text-slate-200">生成收据（导出 Word）</p>
        {hasDetail ? (
          <>
            {Number.isFinite(line) && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                本次开具金额：¥{line.toFixed(2)}
              </p>
            )}
            {Number.isFinite(after) && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                操作后已开收据累计：¥{after.toFixed(2)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">{log.summary}</p>
        )}
      </div>
    )
  } else if (log.action === 'receipt_void' && meta) {
    const voidAmt =
      meta.receiptVoidAmount != null && meta.receiptVoidAmount !== ''
        ? Number(meta.receiptVoidAmount)
        : NaN
    const after =
      meta.receiptIssuedTotalAfter != null && meta.receiptIssuedTotalAfter !== ''
        ? Number(meta.receiptIssuedTotalAfter)
        : NaN
    const hasDetail = Number.isFinite(voidAmt) || Number.isFinite(after)
    head = (
      <div className="space-y-1 mb-1">
        <p className="text-slate-800 dark:text-slate-200">作废收据</p>
        {hasDetail ? (
          <>
            {Number.isFinite(voidAmt) && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                本次作废金额：¥{voidAmt.toFixed(2)}
              </p>
            )}
            {Number.isFinite(after) && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                作废后本账单已开收据累计：¥{after.toFixed(2)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">{log.summary}</p>
        )}
      </div>
    )
  }

  if (!head && log.summary) {
    head = <p className="text-slate-800 dark:text-slate-200 mb-1">{log.summary}</p>
  }

  return (
    <>
      {head}
      {changes.length > 0 && (
        <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400">
          {changes.map((c) => (
            <li key={c.field}>
              <span className="font-medium text-slate-700 dark:text-slate-300">{c.label}</span>
              ：{c.from} → {c.to}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
