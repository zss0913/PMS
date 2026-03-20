import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import {
  logBillActivity,
  BILL_ACTION,
  authUserForLog,
  formatMoneyYuan,
  paymentStatusZh,
} from '@/lib/bill-activity-log'
import type { Prisma } from '@prisma/client'

const createSchema = z.object({
  tenantId: z.number().int().min(1, '请选择租客'),
  billIds: z.array(z.number().int().min(1)).min(1, '请至少选择一个账单'),
  totalAmount: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  paymentMethod: z.string().min(1, '请选择支付方式'),
  payer: z.string().min(1, '缴纳人必填'),
  paidAt: z.string().optional(),
})

/** code 全局唯一，不能按公司 count+1；删除记录后序号也会回退导致冲突。循环探测直至可用。 */
async function allocateUniquePaymentCode(
  tx: Prisma.TransactionClient
): Promise<string> {
  const dayPrefix = `PAY${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  let n = (await tx.payment.count()) + 1
  let attempts = 0
  while (attempts < 50000) {
    const code = `${dayPrefix}${String(n).padStart(4, '0')}`
    const exists = await tx.payment.findUnique({ where: { code } })
    if (!exists) return code
    n++
    attempts++
  }
  throw new Error('无法生成唯一缴费单号，请稍后重试')
}

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

    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = { companyId: user.companyId }
    if (tenantId) {
      const tid = parseInt(tenantId, 10)
      if (!isNaN(tid)) where.tenantId = tid
    }
    if (startDate || endDate) {
      where.paidAt = {}
      if (startDate) (where.paidAt as Record<string, Date>).gte = new Date(startDate)
      if (endDate) (where.paidAt as Record<string, Date>).lte = new Date(endDate + 'T23:59:59')
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        bills: { include: { bill: { select: { id: true, code: true } } } },
      },
      orderBy: { paidAt: 'desc' },
    })

    const tenants = await prisma.tenant.findMany({
      where: { companyId: user.companyId },
      select: { id: true, companyName: true },
      orderBy: { id: 'asc' },
    })

    const list = payments.map((p) => ({
      id: p.id,
      code: p.code,
      tenantId: p.tenantId,
      tenant: tenants.find((t) => t.id === p.tenantId),
      paidAt: p.paidAt.toISOString(),
      payer: p.payer,
      totalAmount: Number(p.totalAmount),
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      billCount: p.bills.length,
      createdAt: p.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { list, tenants },
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

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.tenantId, companyId: user.companyId },
    })
    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 400 })
    }

    const bills = await prisma.bill.findMany({
      where: {
        id: { in: parsed.billIds },
        tenantId: parsed.tenantId,
        companyId: user.companyId,
        paymentStatus: { not: 'paid' },
      },
      orderBy: { dueDate: 'asc' },
    })

    if (bills.length === 0) {
      return NextResponse.json({ success: false, message: '没有可缴纳的账单' }, { status: 400 })
    }

    const totalDue = bills.reduce((sum, b) => sum + Number(b.amountDue), 0)
    if (!Number.isFinite(parsed.totalAmount) || parsed.totalAmount <= 0) {
      return NextResponse.json({ success: false, message: '缴纳金额必须大于0' }, { status: 400 })
    }

    const paidAt = parsed.paidAt ? new Date(parsed.paidAt) : new Date()

    let remaining = parsed.totalAmount
    const allocations: { billId: number; billCode: string; amount: number; amountDueBefore: number; amountDueAfter: number }[] = []
    const paymentBillData: { billId: number; billCode: string; amount: number; amountDueBefore: number; amountDueAfter: number }[] = []

    for (const bill of bills) {
      if (remaining <= 0) break
      const amountDueBefore = Number(bill.amountDue)
      const payAmount = Math.min(remaining, amountDueBefore)
      if (payAmount <= 0) continue

      const amountDueAfter = amountDueBefore - payAmount
      remaining -= payAmount

      allocations.push({
        billId: bill.id,
        billCode: bill.code,
        amount: payAmount,
        amountDueBefore,
        amountDueAfter,
      })
      paymentBillData.push({
        billId: bill.id,
        billCode: bill.code,
        amount: payAmount,
        amountDueBefore,
        amountDueAfter,
      })
    }

    if (paymentBillData.length === 0) {
      return NextResponse.json(
        { success: false, message: '所选账单当前无可缴金额，请刷新后重试' },
        { status: 400 }
      )
    }

    const op = authUserForLog(user)

    /** 操作日志在事务外写入：SQLite 下事务内写 BillActivityLog（含 raw 回退）易导致整笔缴费失败 */
    type PendingPaymentLog = Parameters<typeof logBillActivity>[1]
    const pendingLogs: PendingPaymentLog[] = []

    const payment = await prisma.$transaction(async (tx) => {
      const code = await allocateUniquePaymentCode(tx)
      const pay = await tx.payment.create({
        data: {
          code,
          tenantId: parsed.tenantId,
          paidAt,
          payer: parsed.payer,
          totalAmount: new Decimal(parsed.totalAmount),
          paymentMethod: parsed.paymentMethod,
          paymentStatus: 'success',
          operatorId: user!.id,
          companyId: user!.companyId,
        },
      })

      for (const pb of paymentBillData) {
        await tx.paymentBill.create({
          data: {
            paymentId: pay.id,
            billId: pb.billId,
            billCode: pb.billCode,
            amount: new Decimal(pb.amount),
            amountDueBefore: new Decimal(pb.amountDueBefore),
            amountDueAfter: new Decimal(pb.amountDueAfter),
          },
        })

        const billBefore = await tx.bill.findUnique({ where: { id: pb.billId } })
        if (!billBefore) {
          throw new Error(`账单 ${pb.billId} 不存在，已中止缴费`)
        }
        const newPaid = Number(billBefore.amountPaid) + pb.amount
        const newDue = pb.amountDueAfter
        const paymentStatus = newDue <= 0 ? 'paid' : 'partial'
        await tx.bill.update({
          where: { id: pb.billId },
          data: {
            amountPaid: new Decimal(newPaid),
            amountDue: new Decimal(newDue),
            paymentStatus,
          },
        })
        pendingLogs.push({
          billId: pb.billId,
          billCode: pb.billCode,
          companyId: user.companyId,
          action: BILL_ACTION.PAYMENT,
          summary: `线下缴费入账（缴费单 ${pay.code}）`,
          changes: [
            {
              field: 'amountPaid',
              label: '已缴金额',
              from: formatMoneyYuan(Number(billBefore.amountPaid)),
              to: formatMoneyYuan(newPaid),
            },
            {
              field: 'amountDue',
              label: '待缴金额',
              from: formatMoneyYuan(Number(billBefore.amountDue)),
              to: formatMoneyYuan(newDue),
            },
            {
              field: 'paymentStatus',
              label: '结清状态',
              from: paymentStatusZh(billBefore.paymentStatus ?? ''),
              to: paymentStatusZh(paymentStatus),
            },
          ],
          meta: {
            paymentId: pay.id,
            paymentCode: pay.code,
            allocatedAmount: pb.amount,
            paymentMethod: parsed.paymentMethod,
          },
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          operatorPhone: op.operatorPhone,
        })
      }

      return pay
    })

    for (const log of pendingLogs) {
      try {
        await logBillActivity(prisma, log)
      } catch (logErr) {
        console.error('[payments] 缴费已成功，操作日志写入失败', logErr)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: payment.id,
        code: payment.code,
        allocations,
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
    let message = '服务器错误'
    if (e instanceof PrismaClientKnownRequestError) {
      message = e.code === 'P2002' ? '缴费单编号冲突，请重试' : `${e.code}: ${e.message}`
    } else if (e instanceof Error && e.message) {
      message = e.message
    }
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
