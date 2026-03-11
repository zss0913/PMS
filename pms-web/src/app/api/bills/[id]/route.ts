import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  remark: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const billId = parseInt(id, 10)
    if (isNaN(billId)) {
      return NextResponse.json({ success: false, message: '无效的账单ID' }, { status: 400 })
    }

    const bill = await prisma.bill.findFirst({
      where: { id: billId, companyId: user.companyId },
      include: {
        tenant: { select: { id: true, companyName: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        building: { select: { id: true, name: true } },
        payments: { include: { payment: true } },
        refunds: true,
      },
    })

    if (!bill) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...bill,
        accountReceivable: Number(bill.accountReceivable),
        amountPaid: Number(bill.amountPaid),
        amountDue: Number(bill.amountDue),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const billId = parseInt(id, 10)
    if (isNaN(billId)) {
      return NextResponse.json({ success: false, message: '无效的账单ID' }, { status: 400 })
    }

    const existing = await prisma.bill.findFirst({
      where: { id: billId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (parsed.status !== undefined) updateData.status = parsed.status
    if (parsed.remark !== undefined) updateData.remark = parsed.remark

    const bill = await prisma.bill.update({
      where: { id: billId },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: bill })
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
