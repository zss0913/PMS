import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cancelPendingFeePaymentsForWorkOrderBill } from '@/lib/mp-work-order-fee-pay'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

/** 租客端：拒绝付费，工单取消（待租客确认费用 → 已取消） */
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

    if (wo.status !== '待租客确认费用') {
      return NextResponse.json(
        { success: false, message: '当前工单不在待租客确认费用状态' },
        { status: 400 }
      )
    }

    let reason = ''
    try {
      const body = (await request.json()) as { reason?: unknown }
      if (typeof body?.reason === 'string') reason = body.reason.trim().slice(0, 500)
    } catch {
      // 无 body 亦可
    }

    const feeBill = await prisma.bill.findFirst({
      where: {
        companyId: user.companyId,
        workOrderId,
        billSource: 'work_order_fee',
      },
      orderBy: { id: 'desc' },
    })
    if (feeBill) {
      await cancelPendingFeePaymentsForWorkOrderBill(prisma, feeBill.id, user.companyId)
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status: '已取消' },
    })

    const summary =
      reason.length > 0
        ? `待租客确认费用 → 已取消（租客拒绝付费）：${reason}`
        : '待租客确认费用 → 已取消（租客拒绝付费）'

    await logWorkOrderActivity(prisma, {
      workOrderId,
      workOrderCode: wo.code,
      companyId: user.companyId,
      action: WORK_ORDER_ACTION.FEE_REFUSE_TENANT,
      summary,
      meta: reason ? { reason } : undefined,
      ...operatorFromAuthUser(user),
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
