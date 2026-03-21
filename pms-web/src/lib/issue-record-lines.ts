import { prisma } from '@/lib/prisma'

/** JSON 中单行原始结构（兼容仅含 billId/code/amount 的旧数据） */
export type ParsedLineRaw = {
  billId: number
  code: string
  amount: number
  accountReceivable?: number
  amountPaid?: number
  amountDue?: number
  invoiceIssuedTotalAfter?: number
  receiptIssuedTotalAfter?: number
  feeType?: string
  dueDate?: string
}

export type InvoiceRecordLineDTO = {
  billId: number
  code: string
  /** 本次开票金额 */
  lineAmount: number
  accountReceivable: number
  amountPaid: number
  amountDue: number
  /** 登记完成后该账单已开票累计（快照；旧数据为当前库值） */
  invoiceIssuedTotal: number
  feeType: string
  dueDate: string
}

export type ReceiptRecordLineDTO = {
  billId: number
  code: string
  /** 本次开具金额 */
  lineAmount: number
  accountReceivable: number
  amountPaid: number
  amountDue: number
  /** 开具完成后该账单已开收据累计（快照；旧数据为当前库值） */
  receiptIssuedTotal: number
  feeType: string
  dueDate: string
}

export function parseLineAmountsJson(json: string): ParsedLineRaw[] {
  try {
    const a = JSON.parse(json) as unknown
    if (!Array.isArray(a)) return []
    const out: ParsedLineRaw[] = []
    for (const x of a) {
      if (typeof x !== 'object' || x === null) continue
      const o = x as Record<string, unknown>
      const billId = typeof o.billId === 'number' ? o.billId : Number(o.billId)
      const code = typeof o.code === 'string' ? o.code : String(o.code ?? '')
      const amount = typeof o.amount === 'number' ? o.amount : Number(o.amount)
      if (!Number.isFinite(billId) || billId <= 0 || !Number.isFinite(amount)) continue
      out.push({
        billId,
        code,
        amount,
        accountReceivable: numOrUndef(o.accountReceivable),
        amountPaid: numOrUndef(o.amountPaid),
        amountDue: numOrUndef(o.amountDue),
        invoiceIssuedTotalAfter: numOrUndef(o.invoiceIssuedTotalAfter),
        receiptIssuedTotalAfter: numOrUndef(o.receiptIssuedTotalAfter),
        feeType: strOrUndef(o.feeType),
        dueDate: strOrUndef(o.dueDate),
      })
    }
    return out
  } catch {
    return []
  }
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function needsInvoiceEnrich(line: ParsedLineRaw): boolean {
  return (
    line.accountReceivable === undefined ||
    line.amountPaid === undefined ||
    line.amountDue === undefined ||
    line.invoiceIssuedTotalAfter === undefined ||
    line.feeType === undefined ||
    line.dueDate === undefined
  )
}

function needsReceiptEnrich(line: ParsedLineRaw): boolean {
  return (
    line.accountReceivable === undefined ||
    line.amountPaid === undefined ||
    line.amountDue === undefined ||
    line.receiptIssuedTotalAfter === undefined ||
    line.feeType === undefined ||
    line.dueDate === undefined
  )
}

/** 为列表页批量补全行明细（新 JSON 有快照则直接用，否则按 billId 查库） */
export async function enrichInvoiceLinesForRecords(
  lineAmountsJsonList: string[],
  companyId: number
): Promise<InvoiceRecordLineDTO[][]> {
  const parsed = lineAmountsJsonList.map((json) => parseLineAmountsJson(json))
  const billIds = new Set<number>()
  for (const lines of parsed) {
    for (let i = 0; i < lines.length; i++) {
      if (needsInvoiceEnrich(lines[i]!)) billIds.add(lines[i]!.billId)
    }
  }

  const bills =
    billIds.size > 0
      ? await prisma.bill.findMany({
          where: { companyId, id: { in: [...billIds] } },
          select: {
            id: true,
            accountReceivable: true,
            amountPaid: true,
            amountDue: true,
            invoiceIssuedAmount: true,
            feeType: true,
            dueDate: true,
          },
        })
      : []
  const billMap = new Map(bills.map((b) => [b.id, b]))

  return parsed.map((lines) =>
    lines.map((line) => {
      if (!needsInvoiceEnrich(line)) {
        return {
          billId: line.billId,
          code: line.code,
          lineAmount: line.amount,
          accountReceivable: line.accountReceivable!,
          amountPaid: line.amountPaid!,
          amountDue: line.amountDue!,
          invoiceIssuedTotal: line.invoiceIssuedTotalAfter!,
          feeType: line.feeType!,
          dueDate: line.dueDate!,
        }
      }
      const b = billMap.get(line.billId)
      if (!b) {
        return {
          billId: line.billId,
          code: line.code,
          lineAmount: line.amount,
          accountReceivable: 0,
          amountPaid: 0,
          amountDue: 0,
          invoiceIssuedTotal: 0,
          feeType: '—',
          dueDate: '—',
        }
      }
      return {
        billId: line.billId,
        code: line.code,
        lineAmount: line.amount,
        accountReceivable: Number(b.accountReceivable),
        amountPaid: Number(b.amountPaid ?? 0),
        amountDue: Number(b.amountDue),
        invoiceIssuedTotal: Number(b.invoiceIssuedAmount ?? 0),
        feeType: b.feeType,
        dueDate: b.dueDate.toISOString().slice(0, 10),
      }
    })
  )
}

export async function enrichReceiptLinesForRecords(
  lineAmountsJsonList: string[],
  companyId: number
): Promise<ReceiptRecordLineDTO[][]> {
  const parsed = lineAmountsJsonList.map((json) => parseLineAmountsJson(json))
  const billIds = new Set<number>()
  for (const lines of parsed) {
    for (const line of lines) {
      if (needsReceiptEnrich(line)) billIds.add(line.billId)
    }
  }

  const bills =
    billIds.size > 0
      ? await prisma.bill.findMany({
          where: { companyId, id: { in: [...billIds] } },
          select: {
            id: true,
            accountReceivable: true,
            amountPaid: true,
            amountDue: true,
            receiptIssuedAmount: true,
            feeType: true,
            dueDate: true,
          },
        })
      : []
  const billMap = new Map(bills.map((b) => [b.id, b]))

  return parsed.map((lines) =>
    lines.map((line) => {
      if (!needsReceiptEnrich(line)) {
        return {
          billId: line.billId,
          code: line.code,
          lineAmount: line.amount,
          accountReceivable: line.accountReceivable!,
          amountPaid: line.amountPaid!,
          amountDue: line.amountDue!,
          receiptIssuedTotal: line.receiptIssuedTotalAfter!,
          feeType: line.feeType!,
          dueDate: line.dueDate!,
        }
      }
      const b = billMap.get(line.billId)
      if (!b) {
        return {
          billId: line.billId,
          code: line.code,
          lineAmount: line.amount,
          accountReceivable: 0,
          amountPaid: 0,
          amountDue: 0,
          receiptIssuedTotal: 0,
          feeType: '—',
          dueDate: '—',
        }
      }
      return {
        billId: line.billId,
        code: line.code,
        lineAmount: line.amount,
        accountReceivable: Number(b.accountReceivable),
        amountPaid: Number(b.amountPaid ?? 0),
        amountDue: Number(b.amountDue),
        receiptIssuedTotal: Number(b.receiptIssuedAmount ?? 0),
        feeType: b.feeType,
        dueDate: b.dueDate.toISOString().slice(0, 10),
      }
    })
  )
}
