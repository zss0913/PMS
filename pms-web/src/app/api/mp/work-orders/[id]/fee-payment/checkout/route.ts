import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createFeeCheckoutPayment } from '@/lib/mp-work-order-fee-pay'
import { operatorFromAuthUser } from '@/lib/work-order-activity-log'

const bodySchema = z.object({
  billId: z.number().int().min(1),
  channel: z.enum(['wechat', 'alipay']),
})

/**
 * 租客端：选择微信/支付宝下单，生成 pending 缴费单。
 * 正式环境需在客户端调起支付，支付成功后由网关通知或客户端调 complete。
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

    const bill = await prisma.bill.findFirst({
      where: {
        id: parsed.billId,
        companyId: user.companyId,
        tenantId: { in: tenantIds },
        workOrderId,
        billSource: 'work_order_fee',
      },
    })
    if (!bill) {
      return NextResponse.json({ success: false, message: '账单与工单不匹配' }, { status: 400 })
    }

    const payer =
      [user.name, user.phone].filter((x) => x && String(x).trim()).join(' ') || '租客'

    const r = await createFeeCheckoutPayment(prisma, {
      billId: parsed.billId,
      companyId: user.companyId,
      tenantId: bill.tenantId,
      channel: parsed.channel,
      payer,
      operator: operatorFromAuthUser(user),
    })

    if (!r.ok) {
      return NextResponse.json({ success: false, message: r.message }, { status: r.status })
    }

    return NextResponse.json({
      success: true,
      data: {
        payment: r.payment,
        /** 未接入真实微信/支付宝 SDK 时，由客户端在支付完成后调用 complete */
        nextStep: 'POST /api/mp/work-orders/{id}/fee-payment/complete',
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
