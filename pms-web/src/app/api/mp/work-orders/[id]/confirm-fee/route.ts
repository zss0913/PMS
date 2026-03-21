import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

/** 租客端：确认费用说明，继续维修（待确认费用 → 处理中） */
export async function POST(
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
      return NextResponse.json({ success: false, message: '无租客关联' }, { status: 400 })
    }

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const wo = await prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        companyId: user.companyId,
        OR: [{ tenantId: { in: tenantIds } }, { reporterId: user.id }],
      },
    })

    if (!wo) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    if (wo.status !== '待确认费用') {
      return NextResponse.json(
        { success: false, message: '当前工单不在待确认费用状态' },
        { status: 400 }
      )
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: '处理中',
        feeConfirmedAt: new Date(),
      },
    })

    await logWorkOrderActivity(prisma, {
      workOrderId,
      workOrderCode: wo.code,
      companyId: user.companyId,
      action: WORK_ORDER_ACTION.FEE_CONFIRM_TENANT,
      summary: '待确认费用 → 处理中（租客已确认费用说明）',
      ...operatorFromAuthUser(user),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
