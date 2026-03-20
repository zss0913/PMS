import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'
import {
  logBillActivity,
  BILL_ACTION,
  authUserForLog,
  formatMoneyYuan,
  paymentStatusZh,
} from '@/lib/bill-activity-log'

/** code 全局唯一，不能按公司 count+1；与 Payment 编号策略一致 */
async function allocateUniqueRefundCode(tx: Prisma.TransactionClient): Promise<string> {
  const dayPrefix = `REF${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  let n = (await tx.refund.count()) + 1
  let attempts = 0
  while (attempts < 50000) {
    const code = `${dayPrefix}${String(n).padStart(4, '0')}`
    const exists = await tx.refund.findUnique({ where: { code } })
    if (!exists) return code
    n++
    attempts++
  }
  throw new Error('无法生成唯一退费单号，请稍后重试')
}

const createSchema = z.object({
  billId: z.number().int().min(1, '请选择账单'),
  amount: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  reason: z.string().min(1, '退费原因必填'),
  remark: z.string().optional(),
  refunder: z.string().min(1, '退费人必填'),
})

export async function GET(request: NextRequest) {
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

    const refunds = await prisma.refund.findMany({
      where: { companyId: user.companyId },
      include: {
        bill: {
          select: {
            id: true,
            code: true,
            tenant: { select: { id: true, companyName: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    const list = refunds.map((r) => ({
      id: r.id,
      code: r.code,
      billId: r.billId,
      bill: r.bill,
      tenant: r.bill.tenant,
      refundAt: r.refundAt.toISOString(),
      refunder: r.refunder,
      amount: Number(r.amount),
      reason: r.reason,
      remark: r.remark,
      createdAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { list },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
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

    const body = await request.json()
    const parsed = createSchema.parse(body)

    const bill = await prisma.bill.findFirst({
      where: { id: parsed.billId, companyId: user.companyId },
    })
    if (!bill) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 400 })
    }

    const amountPaid = Number(bill.amountPaid)
    if (parsed.amount <= 0) {
      return NextResponse.json({ success: false, message: '退费金额必须大于0' }, { status: 400 })
    }
    if (parsed.amount > amountPaid) {
      return NextResponse.json({ success: false, message: '退费金额不能大于已缴金额' }, { status: 400 })
    }

    const op = authUserForLog(user)

    const newPaid = amountPaid - parsed.amount
    const newDue = Number(bill.amountDue) + parsed.amount
    const paymentStatus = newPaid <= 0 ? 'unpaid' : newDue <= 0 ? 'paid' : 'partial'

    /** 操作日志在事务外写入：SQLite 下事务内写 BillActivityLog 易导致整笔退费失败 */
    const refund = await prisma.$transaction(async (tx) => {
      const code = await allocateUniqueRefundCode(tx)
      const r = await tx.refund.create({
        data: {
          code,
          billId: parsed.billId,
          tenantId: bill.tenantId,
          refundAt: new Date(),
          refunder: parsed.refunder,
          operatorId: user!.id,
          amount: new Decimal(parsed.amount),
          reason: parsed.reason,
          remark: parsed.remark ?? null,
          companyId: user!.companyId,
        },
      })

      await tx.bill.update({
        where: { id: parsed.billId },
        data: {
          amountPaid: new Decimal(newPaid),
          amountDue: new Decimal(newDue),
          paymentStatus,
        },
      })

      return r
    })

    try {
      await logBillActivity(prisma, {
        billId: bill.id,
        billCode: bill.code,
        companyId: user.companyId,
        action: BILL_ACTION.REFUND,
        summary: `退费（退费单 ${refund.code}）`,
        changes: [
          {
            field: 'amountPaid',
            label: '已缴金额',
            from: formatMoneyYuan(amountPaid),
            to: formatMoneyYuan(newPaid),
          },
          {
            field: 'amountDue',
            label: '待缴金额',
            from: formatMoneyYuan(Number(bill.amountDue)),
            to: formatMoneyYuan(newDue),
          },
          {
            field: 'paymentStatus',
            label: '结清状态',
            from: paymentStatusZh(bill.paymentStatus),
            to: paymentStatusZh(paymentStatus),
          },
        ],
        meta: {
          refundId: refund.id,
          refundCode: refund.code,
          amount: parsed.amount,
          reason: parsed.reason,
          refunder: parsed.refunder,
        },
        operatorId: op.operatorId,
        operatorName: op.operatorName,
        operatorPhone: op.operatorPhone,
      })
    } catch (logErr) {
      console.error('[refunds] 退费已成功，操作日志写入失败', logErr)
    }

    return NextResponse.json({
      success: true,
      data: { id: refund.id, code: refund.code },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
