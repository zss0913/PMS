import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const createSchema = z.object({
  tenantId: z.number().int().min(1, '请选择租客'),
  billIds: z.array(z.number().int().min(1)).min(1, '请至少选择一个账单'),
  totalAmount: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  paymentMethod: z.string().min(1, '请选择支付方式'),
  payer: z.string().min(1, '缴纳人必填'),
  paidAt: z.string().optional(),
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
    if (parsed.totalAmount <= 0) {
      return NextResponse.json({ success: false, message: '缴纳金额必须大于0' }, { status: 400 })
    }

    const paidAt = parsed.paidAt ? new Date(parsed.paidAt) : new Date()
    const count = await prisma.payment.count({ where: { companyId: user.companyId } })
    const code = `PAY${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(count + 1).padStart(4, '0')}`

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

    const payment = await prisma.$transaction(async (tx) => {
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

        const bill = await tx.bill.findUnique({ where: { id: pb.billId } })
        if (bill) {
          const newPaid = Number(bill.amountPaid) + pb.amount
          const newDue = Number(bill.amountDue) - pb.amount
          const paymentStatus = newDue <= 0 ? 'paid' : 'partial'
          await tx.bill.update({
            where: { id: pb.billId },
            data: {
              amountPaid: new Decimal(newPaid),
              amountDue: new Decimal(newDue),
              paymentStatus,
            },
          })
        }
      }

      return pay
    })

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
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
