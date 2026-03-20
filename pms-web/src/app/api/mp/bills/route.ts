import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'

/** 租客端：获取当前租客的账单列表（仅租客管理员可看） */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json(
      { success: false, message: '未登录或无权限' },
      { status: 401 }
    )
  }
  const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
  if (tenantIds.length === 0) {
    return NextResponse.json({ success: true, list: [] })
  }

  const buildingId = request.nextUrl.searchParams.get('buildingId')
  const where: Record<string, unknown> = {
    tenantId: { in: tenantIds },
    companyId: user.companyId,
  }
  if (buildingId) where.buildingId = parseInt(buildingId, 10)

  const bills = await prisma.bill.findMany({
    where,
    include: {
      room: { select: { name: true, roomNumber: true } },
      tenant: { select: { companyName: true } },
    },
    orderBy: { dueDate: 'desc' },
  })

  const list = bills.map((b) => ({
    id: b.id,
    code: b.code,
    ruleName: b.ruleName,
    feeType: b.feeType,
    period: b.period,
    accountReceivable: Number(b.accountReceivable),
    amountPaid: Number(b.amountPaid),
    amountDue: Number(b.amountDue),
    status: b.status,
    paymentStatus: b.paymentStatus,
    dueDate: b.dueDate,
    room: formatBillRoomsDisplay(b.remark, b.room),
    tenantName: b.tenant?.companyName,
  }))

  return NextResponse.json({ success: true, list })
}
