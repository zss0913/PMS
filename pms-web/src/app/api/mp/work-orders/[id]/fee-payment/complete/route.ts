import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { completeWorkOrderFeePayment } from '@/lib/mp-work-order-fee-pay'

const bodySchema = z.object({
  paymentId: z.number().int().min(1),
  gatewayTradeNo: z.string().max(128).optional(),
})

/**
 * 租客端：支付成功后确认入账并推进工单（待租客确认费用 → 处理中）。
 * 接入微信/支付宝后，应由服务端验签再调用内部逻辑；当前也可由客户端在调起支付成功后调用。
 */
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

    const json = await request.json()
    const parsed = bodySchema.parse(json)

    const pay = await prisma.payment.findFirst({
      where: {
        id: parsed.paymentId,
        companyId: user.companyId,
        tenantId: { in: tenantIds },
      },
    })
    if (pay?.relatedBillId == null) {
      return NextResponse.json(
        { success: false, message: '缴费单与当前工单不匹配' },
        { status: 400 }
      )
    }
    const billCheck = await prisma.bill.findFirst({
      where: {
        id: pay.relatedBillId,
        companyId: user.companyId,
        workOrderId,
        billSource: 'work_order_fee',
      },
    })
    if (!billCheck) {
      return NextResponse.json(
        { success: false, message: '缴费单与当前工单不匹配' },
        { status: 400 }
      )
    }

    const r = await completeWorkOrderFeePayment(prisma, {
      paymentId: parsed.paymentId,
      companyId: user.companyId,
      tenantIds,
      user,
      gatewayTradeNo: parsed.gatewayTradeNo ?? null,
    })

    if (!r.ok) {
      return NextResponse.json({ success: false, message: r.message }, { status: r.status })
    }

    return NextResponse.json({ success: true })
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
