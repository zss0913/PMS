import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'

async function resolveEffectiveTenantIds(userId: number, jwtRelations: { tenantId: number; buildingId: number }[] = []) {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: userId },
    select: {
      relations: {
        select: { tenantId: true, buildingId: true },
      },
    },
  })
  const dbRelations = tenantUser?.relations ?? []
  if (dbRelations.length === 0) {
    return []
  }
  if (jwtRelations.length === 0) {
    return Array.from(new Set(dbRelations.map((r) => r.tenantId)))
  }
  const scoped = dbRelations.filter((r) =>
    jwtRelations.some(
      (jr) => jr.tenantId === r.tenantId && jr.buildingId === r.buildingId
    )
  )
  const effective = scoped.length > 0 ? scoped : dbRelations
  return Array.from(new Set(effective.map((r) => r.tenantId)))
}

function billIsOverdue(dueDate: Date, paymentStatus: string): boolean {
  if (paymentStatus === 'paid') return false
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  const due = dueDate.toISOString().slice(0, 10)
  return due < today
}

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

    const tenantIds = await resolveEffectiveTenantIds(user.id, user.relations ?? [])
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
        invoiceIssuedAmount: Number(bill.invoiceIssuedAmount),
        receiptIssuedAmount: Number(bill.receiptIssuedAmount),
        status: bill.status,
        paymentStatus: bill.paymentStatus,
        dueDate: bill.dueDate,
        overdue: billIsOverdue(bill.dueDate, bill.paymentStatus),
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
