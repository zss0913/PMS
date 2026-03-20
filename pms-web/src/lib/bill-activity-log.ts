import type { Prisma, PrismaClient } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { insertBillActivityLog } from '@/lib/bill-activity-log-db'

export const BILL_ACTION = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  PAYMENT: 'payment',
  REFUND: 'refund',
  RECEIPT_EXPORT: 'receipt_export',
  DUNNING_EXPORT: 'dunning_export',
  REMINDER_RECORD: 'reminder_record',
} as const

type Db = PrismaClient | Prisma.TransactionClient

export type BillChangeEntry = { field: string; label: string; from: string; to: string }

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '（空）'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export function buildBillChanges(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
  fieldLabels: Record<string, string>
): BillChangeEntry[] {
  const out: BillChangeEntry[] = []
  for (const key of Object.keys(fieldLabels)) {
    const a = oldRow[key]
    const b = newRow[key]
    const fs = formatVal(a)
    const ts = formatVal(b)
    if (fs !== ts) {
      out.push({ field: key, label: fieldLabels[key]!, from: fs, to: ts })
    }
  }
  return out
}

export function authUserForLog(user: AuthUser): {
  operatorId: number
  operatorName: string
  operatorPhone: string
} {
  return {
    operatorId: user.id,
    operatorName: user.name ?? '',
    operatorPhone: user.phone ?? '',
  }
}

export function formatMoneyYuan(n: number): string {
  return `¥${Number(n).toFixed(2)}`
}

export function paymentStatusZh(s: string): string {
  const m: Record<string, string> = {
    unpaid: '未缴纳',
    partial: '部分缴纳',
    paid: '已结清',
  }
  return m[s] ?? s
}

export function billStatusZh(s: string): string {
  if (s === 'open') return '开启'
  if (s === 'closed') return '关闭'
  return s
}

export async function logBillActivity(
  db: Db,
  input: {
    billId: number
    billCode: string
    companyId: number
    action: string
    summary?: string
    changes?: BillChangeEntry[]
    meta?: Record<string, unknown>
    operatorId: number
    operatorName: string
    operatorPhone: string
  }
) {
  await insertBillActivityLog(db, {
    billId: input.billId,
    billCode: input.billCode,
    companyId: input.companyId,
    action: input.action,
    summary: input.summary ?? null,
    changesJson: input.changes?.length ? JSON.stringify(input.changes) : null,
    metaJson: input.meta ? JSON.stringify(input.meta) : null,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    operatorPhone: input.operatorPhone,
  })
}
