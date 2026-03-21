import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BILL_ACTION, authUserForLog, logBillActivity } from '@/lib/bill-activity-log'

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '请至少选择一条开票记录'),
  type: z.enum(['void', 'reversal'], { message: 'type 须为 void（作废）或 reversal（红冲）' }),
})

type LineItem = { billId: number; code: string; amount: number }

function parseLineAmounts(json: string): LineItem[] {
  try {
    const a = JSON.parse(json) as unknown
    if (!Array.isArray(a)) return []
    const out: LineItem[] = []
    for (const x of a) {
      if (typeof x !== 'object' || x === null) continue
      const o = x as Record<string, unknown>
      const billId = typeof o.billId === 'number' ? o.billId : Number(o.billId)
      const code = typeof o.code === 'string' ? o.code : String(o.code ?? '')
      const amount = typeof o.amount === 'number' ? o.amount : Number(o.amount)
      if (!Number.isFinite(billId) || billId <= 0 || !Number.isFinite(amount)) continue
      out.push({ billId, code, amount })
    }
    return out
  } catch {
    return []
  }
}

function mergeAmountsByBill(lines: LineItem[]): Map<number, { code: string; amount: Decimal }> {
  const m = new Map<number, { code: string; amount: Decimal }>()
  for (const l of lines) {
    const d = new Decimal(l.amount)
    const prev = m.get(l.billId)
    if (prev) {
      prev.amount = prev.amount.plus(d)
    } else {
      m.set(l.billId, { code: l.code, amount: d })
    }
  }
  return m
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const raw = await request.json()
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? '参数错误' },
        { status: 400 }
      )
    }
    const { ids, type } = parsed.data
    const uniqueIds = [...new Set(ids)]
    const op = authUserForLog(user)

    const isVoid = type === 'void'
    const action = isVoid ? BILL_ACTION.INVOICE_VOID : BILL_ACTION.INVOICE_REVERSAL
    const summary = isVoid ? '作废开票' : '红冲开票'

    await prisma.$transaction(async (tx) => {
      const records = await tx.invoiceIssueRecord.findMany({
        where: {
          id: { in: uniqueIds },
          companyId: user.companyId,
          voidedAt: null,
          reversedAt: null,
        },
      })

      if (records.length !== uniqueIds.length) {
        const found = new Set(records.map((r) => r.id))
        const missing = uniqueIds.filter((id) => !found.has(id))
        throw new Error(`部分开票记录不存在、已作废或已红冲：ID ${missing.join(', ')}`)
      }

      const sorted = [...records].sort((a, b) => a.id - b.id)

      for (const rec of sorted) {
        const lines = parseLineAmounts(rec.lineAmountsJson)
        if (lines.length === 0) {
          throw new Error(`开票记录 #${rec.id} 无有效明细，无法处理`)
        }
        const byBill = mergeAmountsByBill(lines)

        for (const [billId, { code, amount: cancelAmt }] of byBill) {
          const bill = await tx.bill.findFirst({
            where: { id: billId, companyId: user.companyId },
          })
          if (!bill) {
            throw new Error(`账单 ${code}（ID ${billId}）不存在，无法冲回开票金额`)
          }
          const cur = new Decimal(bill.invoiceIssuedAmount ?? 0)
          if (cur.lt(cancelAmt)) {
            throw new Error(
              `账单 ${bill.code} 当前已开票 ¥${cur.toFixed(2)} 小于本次冲回 ¥${cancelAmt.toFixed(2)}，数据不一致，已中止`
            )
          }
          const after = cur.minus(cancelAmt)

          await tx.bill.update({
            where: { id: bill.id },
            data: { invoiceIssuedAmount: after },
          })

          await logBillActivity(tx, {
            billId: bill.id,
            billCode: bill.code,
            companyId: user.companyId,
            action,
            summary,
            meta: {
              invoiceIssueRecordId: rec.id,
              invoiceBatchId: rec.batchId,
              invoiceCancelAmount: Number(cancelAmt.toFixed(2)),
              invoiceIssuedTotalAfter: Number(after.toFixed(2)),
              cancelType: type,
            },
            operatorId: op.operatorId,
            operatorName: op.operatorName,
            operatorPhone: op.operatorPhone,
          })
        }

        if (isVoid) {
          await tx.invoiceIssueRecord.update({
            where: { id: rec.id },
            data: {
              voidedAt: new Date(),
              voidedOperatorId: op.operatorId,
              voidedOperatorName: op.operatorName || null,
            },
          })
        } else {
          await tx.invoiceIssueRecord.update({
            where: { id: rec.id },
            data: {
              reversedAt: new Date(),
              reversedOperatorId: op.operatorId,
              reversedOperatorName: op.operatorName || null,
            },
          })
        }
      }
    })

    const label = isVoid ? '作废' : '红冲'
    return NextResponse.json({ success: true, message: `已${label} ${uniqueIds.length} 条开票记录` })
  } catch (e) {
    console.error('[invoice-issue-records/cancel]', e)
    const msg = e instanceof Error ? e.message : '操作失败'
    if (
      msg.includes('不存在') ||
      msg.includes('已作废') ||
      msg.includes('已红冲') ||
      msg.includes('小于') ||
      msg.includes('无有效明细') ||
      msg.includes('数据不一致')
    ) {
      return NextResponse.json({ success: false, message: msg }, { status: 400 })
    }
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
