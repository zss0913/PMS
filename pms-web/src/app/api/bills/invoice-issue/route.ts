import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logBillActivity, BILL_ACTION, authUserForLog } from '@/lib/bill-activity-log'

const bodySchema = z.object({
  mergeMode: z.enum(['byTenant', 'perBill']).optional().default('byTenant'),
  lines: z
    .array(
      z.object({
        billId: z.number().int().positive(),
        amount: z.number().positive('本次开票金额须大于 0'),
      })
    )
    .min(1, '请至少提交一条账单'),
})

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

    const json = await request.json()
    const parsed = bodySchema.parse(json)
    const mergeMode = parsed.mergeMode ?? 'byTenant'

    const billIds = [...new Set(parsed.lines.map((l) => l.billId))]
    if (billIds.length !== parsed.lines.length) {
      return NextResponse.json({ success: false, message: '同一账单不能重复提交' }, { status: 400 })
    }

    const bills = await prisma.bill.findMany({
      where: {
        id: { in: billIds },
        companyId: user.companyId,
      },
      include: {
        tenant: { select: { id: true, companyName: true } },
      },
      orderBy: { id: 'asc' },
    })

    if (bills.length !== billIds.length) {
      return NextResponse.json({ success: false, message: '未找到有效账单' }, { status: 400 })
    }

    const billMap = new Map(bills.map((b) => [b.id, b]))
    type Row = (typeof bills)[number] & { invoiceLineAmount: number }
    const withAmount: Row[] = []

    for (const line of parsed.lines) {
      const b = billMap.get(line.billId)
      if (!b) {
        return NextResponse.json({ success: false, message: `账单 id ${line.billId} 不存在` }, { status: 400 })
      }
      const ar = new Decimal(b.accountReceivable)
      const issued = new Decimal(b.invoiceIssuedAmount ?? 0)
      const amt = new Decimal(line.amount)
      if (amt.lte(0)) {
        return NextResponse.json(
          { success: false, message: `账单 ${b.code}：本次开票金额须大于 0` },
          { status: 400 }
        )
      }
      if (issued.plus(amt).gt(ar)) {
        return NextResponse.json(
          {
            success: false,
            message: `账单 ${b.code}：本次开票与已开票金额之和不能超过应收（应收 ¥${ar.toFixed(2)}，已开票 ¥${issued.toFixed(2)}）`,
          },
          { status: 400 }
        )
      }
      withAmount.push({ ...b, invoiceLineAmount: Number(amt.toFixed(2)) })
    }

    const byTenant = new Map<number, Row[]>()
    for (const b of withAmount) {
      const arr = byTenant.get(b.tenantId) ?? []
      arr.push(b)
      byTenant.set(b.tenantId, arr)
    }

    const tenantIds = [...byTenant.keys()]
    const invoiceGroups: Row[][] =
      mergeMode === 'perBill'
        ? withAmount.map((b) => [b])
        : [...tenantIds].sort((a, b) => a - b).map((tid) => byTenant.get(tid)!)

    const batchId = randomUUID()
    const op = authUserForLog(user)

    await prisma.$transaction(async (tx) => {
      for (const b of withAmount) {
        const issuedBefore = new Decimal(b.invoiceIssuedAmount ?? 0)
        const after = issuedBefore.plus(b.invoiceLineAmount)
        await tx.bill.update({
          where: { id: b.id },
          data: {
            invoiceIssuedAmount: { increment: new Decimal(b.invoiceLineAmount) },
          },
        })
        await logBillActivity(tx, {
          billId: b.id,
          billCode: b.code,
          companyId: user.companyId,
          action: BILL_ACTION.INVOICE_ISSUE,
          summary: '开票登记',
          meta: {
            invoiceLineAmount: b.invoiceLineAmount,
            invoiceIssuedTotalAfter: Number(after.toFixed(2)),
            mergeMode,
            batchId,
          },
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          operatorPhone: op.operatorPhone,
        })
      }
    })

    try {
      await prisma.invoiceIssueRecord.createMany({
        data: invoiceGroups.map((group) => {
          const total = group.reduce((s, b) => s + b.invoiceLineAmount, 0)
          return {
            companyId: user.companyId,
            batchId,
            tenantId: group[0].tenantId,
            tenantName: group[0].tenant.companyName,
            mergeMode,
            billCount: group.length,
            totalAmount: new Decimal(total.toFixed(2)),
            billIdsJson: JSON.stringify(group.map((b) => b.id)),
            billCodesJson: JSON.stringify(group.map((b) => b.code)),
            lineAmountsJson: JSON.stringify(
              group.map((b) => {
                const issuedBefore = new Decimal(b.invoiceIssuedAmount ?? 0)
                const invoiceIssuedTotalAfter = Number(
                  issuedBefore.plus(b.invoiceLineAmount).toFixed(2)
                )
                return {
                  billId: b.id,
                  code: b.code,
                  amount: b.invoiceLineAmount,
                  accountReceivable: Number(b.accountReceivable),
                  amountPaid: Number(b.amountPaid ?? 0),
                  amountDue: Number(b.amountDue),
                  invoiceIssuedTotalAfter,
                  feeType: b.feeType,
                  dueDate: b.dueDate.toISOString().slice(0, 10),
                }
              })
            ),
            operatorId: op.operatorId,
            operatorName: op.operatorName,
            operatorPhone: op.operatorPhone,
          }
        }),
      })
    } catch (e) {
      console.error('[invoice-issue] 写入开票记录失败（账单已更新）', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        invoiceCount: invoiceGroups.length,
      },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : '开票失败' },
      { status: 500 }
    )
  }
}
