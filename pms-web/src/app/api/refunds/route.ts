import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

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
        bill: { select: { id: true, code: true }, include: { tenant: { select: { id: true, companyName: true } } } },
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

    const count = await prisma.refund.count({ where: { companyId: user.companyId } })
    const code = `REF${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(count + 1).padStart(4, '0')}`

    const refund = await prisma.$transaction(async (tx) => {
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

      const newPaid = amountPaid - parsed.amount
      const newDue = Number(bill.amountDue) + parsed.amount
      const paymentStatus = newPaid <= 0 ? 'unpaid' : newDue <= 0 ? 'paid' : 'partial'
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
