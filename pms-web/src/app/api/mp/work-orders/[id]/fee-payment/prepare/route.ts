import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  findPendingFeeCheckoutPayment,
  getOrCreateWorkOrderFeeBill,
  tryAdvanceWorkOrderZeroFeeOnTenantPrepare,
} from '@/lib/mp-work-order-fee-pay'
import { operatorFromAuthUser } from '@/lib/work-order-activity-log'

/** 租客端：生成或获取工单费用账单（待租客确认费用） */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(_req)
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

    const zeroSkip = await tryAdvanceWorkOrderZeroFeeOnTenantPrepare(prisma, {
      workOrderId,
      companyId: user.companyId,
      tenantIds,
      tenantUserId: user.id,
      operator: operatorFromAuthUser(user),
    })
    if (zeroSkip.advanced) {
      return NextResponse.json({
        success: true,
        data: {
          zeroFeeSkipped: true,
          bill: null,
          pendingPayment: null,
        },
      })
    }

    const r = await getOrCreateWorkOrderFeeBill(prisma, {
      workOrderId,
      companyId: user.companyId,
      tenantIds,
      tenantUserId: user.id,
      operator: operatorFromAuthUser(user),
    })
    if (!r.ok) {
      return NextResponse.json({ success: false, message: r.message }, { status: r.status })
    }

    const bill = await prisma.bill.findUnique({
      where: { id: r.bill.id },
    })
    if (!bill) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    const pending = await findPendingFeeCheckoutPayment(prisma, bill.id, user.companyId)

    return NextResponse.json({
      success: true,
      data: {
        billCreated: r.created,
        bill: {
          id: bill.id,
          code: bill.code,
          feeType: bill.feeType,
          period: bill.period,
          dueDate: bill.dueDate.toISOString(),
          accountReceivable: Number(bill.accountReceivable),
          amountDue: Number(bill.amountDue),
          paymentStatus: bill.paymentStatus,
          remark: bill.remark,
        },
        pendingPayment: pending
          ? {
              id: pending.id,
              code: pending.code,
              paymentMethod: pending.paymentMethod,
              paymentStatus: pending.paymentStatus,
            }
          : null,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
