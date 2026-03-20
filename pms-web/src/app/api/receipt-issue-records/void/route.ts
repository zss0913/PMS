import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BILL_ACTION, authUserForLog, logBillActivity } from '@/lib/bill-activity-log'

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '请至少选择一条收据记录'),
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

/** 同一收据内同一账单多行合并（金额相加） */
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
    const { ids } = parsed.data
    const uniqueIds = [...new Set(ids)]

    const op = authUserForLog(user)

    await prisma.$transaction(async (tx) => {
      const records = await tx.receiptIssueRecord.findMany({
        where: {
          id: { in: uniqueIds },
          companyId: user.companyId,
          voidedAt: null,
        },
      })

      if (records.length !== uniqueIds.length) {
        const found = new Set(records.map((r) => r.id))
        const missing = uniqueIds.filter((id) => !found.has(id))
        throw new Error(`部分收据不存在或已作废：ID ${missing.join(', ')}`)
      }

      const sorted = [...records].sort((a, b) => a.id - b.id)

      for (const rec of sorted) {
        const lines = parseLineAmounts(rec.lineAmountsJson)
        if (lines.length === 0) {
          throw new Error(`收据记录 #${rec.id} 无有效明细，无法作废`)
        }
        const byBill = mergeAmountsByBill(lines)

        for (const [billId, { code, amount: voidAmt }] of byBill) {
          const bill = await tx.bill.findFirst({
            where: { id: billId, companyId: user.companyId },
          })
          if (!bill) {
            throw new Error(`账单 ${code}（ID ${billId}）不存在，无法作废收据`)
          }
          const cur = new Decimal(bill.receiptIssuedAmount ?? 0)
          if (cur.lt(voidAmt)) {
            throw new Error(
              `账单 ${bill.code} 当前已开收据 ¥${cur.toFixed(2)} 小于本次作废 ¥${voidAmt.toFixed(2)}，数据不一致，已中止`
            )
          }
          const after = cur.minus(voidAmt)

          await tx.bill.update({
            where: { id: bill.id },
            data: { receiptIssuedAmount: after },
          })

          await logBillActivity(tx, {
            billId: bill.id,
            billCode: bill.code,
            companyId: user.companyId,
            action: BILL_ACTION.RECEIPT_VOID,
            summary: '作废收据',
            meta: {
              receiptIssueRecordId: rec.id,
              receiptBatchId: rec.batchId,
              /** 本账单从该条收据记录中冲回的金额（元） */
              receiptVoidAmount: Number(voidAmt.toFixed(2)),
              /** 作废后该账单已开收据累计（元） */
              receiptIssuedTotalAfter: Number(after.toFixed(2)),
            },
            operatorId: op.operatorId,
            operatorName: op.operatorName,
            operatorPhone: op.operatorPhone,
          })
        }

        await tx.receiptIssueRecord.update({
          where: { id: rec.id },
          data: {
            voidedAt: new Date(),
            voidedOperatorId: op.operatorId,
            voidedOperatorName: op.operatorName || null,
          },
        })
      }
    })

    return NextResponse.json({ success: true, message: `已作废 ${uniqueIds.length} 条收据记录` })
  } catch (e) {
    console.error('[receipt-issue-records/void]', e)
    const msg = e instanceof Error ? e.message : '作废失败'
    if (
      msg.includes('不存在') ||
      msg.includes('已作废') ||
      msg.includes('小于') ||
      msg.includes('无有效明细') ||
      msg.includes('数据不一致')
    ) {
      return NextResponse.json({ success: false, message: msg }, { status: 400 })
    }
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
