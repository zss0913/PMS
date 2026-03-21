import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'

/** 租客端：账单详情（须为本账号关联租客下的账单） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
    if (tenantIds.length === 0) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    const { id } = await params
    const billId = parseInt(id, 10)
    if (isNaN(billId)) {
      return NextResponse.json({ success: false, message: '无效的账单ID' }, { status: 400 })
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id: billId,
        companyId: user.companyId,
        tenantId: { in: tenantIds },
      },
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

    const payments = bill.payments.map((bp) => ({
      id: bp.id,
      amount: Number(bp.amount),
      paidAt: bp.payment?.paidAt ?? null,
      paymentMethod: bp.payment?.paymentMethod ?? null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: bill.id,
        code: bill.code,
        ruleName: bill.ruleName,
        feeType: bill.feeType,
        period: bill.period,
        accountReceivable: Number(bill.accountReceivable),
        amountPaid: Number(bill.amountPaid),
        amountDue: Number(bill.amountDue),
        status: bill.status,
        paymentStatus: bill.paymentStatus,
        dueDate: bill.dueDate,
        tenantName: bill.tenant?.companyName,
        buildingName: bill.building?.name,
        room: formatBillRoomsDisplay(bill.remark, bill.room),
        payments,
        refunds: bill.refunds.map((r) => ({
          id: r.id,
          code: r.code,
          amount: Number(r.amount),
          reason: r.reason,
          refundAt: r.refundAt,
        })),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
