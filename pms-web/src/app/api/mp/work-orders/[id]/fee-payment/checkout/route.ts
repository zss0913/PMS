import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createFeeCheckoutPayment } from '@/lib/mp-work-order-fee-pay'
import { operatorFromAuthUser } from '@/lib/work-order-activity-log'
import {
  buildMiniProgramPayParams,
  createWechatJsapiOrder,
  getWechatOpenId,
  getWechatPayConfig,
} from '@/lib/wechat-pay'

const bodySchema = z.object({
  billId: z.number().int().min(1),
  channel: z.enum(['wechat', 'alipay']),
  loginCode: z.string().min(1).optional(),
})

function buildNotifyUrl(request: NextRequest, companyId: number) {
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  return `${proto}://${host}/api/payments/wechat/notify/${companyId}`
}

function buildPayDescription(workOrderCode: string, paymentCode: string) {
  const raw = `工单${workOrderCode}费用支付 ${paymentCode}`
  return raw.length > 120 ? raw.slice(0, 120) : raw
}

function yuanToFen(amount: number) {
  return Math.round(amount * 100)
}

function normalizeErrorMessage(e: unknown) {
  if (e instanceof Error && e.message) return e.message
  return '服务器错误'
}

export const runtime = 'nodejs'

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
    if (parsed.channel !== 'wechat') {
      return NextResponse.json({ success: false, message: '当前仅支持微信支付' }, { status: 400 })
    }
    if (!parsed.loginCode) {
      return NextResponse.json({ success: false, message: '缺少微信登录凭证' }, { status: 400 })
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id: parsed.billId,
        companyId: user.companyId,
        tenantId: { in: tenantIds },
        workOrderId,
        billSource: 'work_order_fee',
      },
      select: {
        id: true,
        code: true,
        amountDue: true,
        tenantId: true,
      },
    })
    if (!bill) {
      return NextResponse.json({ success: false, message: '账单与工单不匹配' }, { status: 400 })
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { code: true },
    })
    if (!workOrder) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        appId: true,
        appSecret: true,
        wechatMchId: true,
        wechatMchSerialNo: true,
        wechatApiV3Key: true,
        wechatPrivateKeyPem: true,
      },
    })
    if (!company) {
      return NextResponse.json({ success: false, message: '公司不存在' }, { status: 404 })
    }

    const payer =
      [user.name, user.phone].filter((x) => x && String(x).trim()).join(' ') || '租客'

    const checkout = await createFeeCheckoutPayment(prisma, {
      billId: parsed.billId,
      companyId: user.companyId,
      tenantId: bill.tenantId,
      channel: parsed.channel,
      payer,
      operator: operatorFromAuthUser(user),
    })
    if (!checkout.ok) {
      return NextResponse.json(
        { success: false, message: checkout.message },
        { status: checkout.status }
      )
    }

    try {
      const config = getWechatPayConfig(company)
      const openId = await getWechatOpenId(config, parsed.loginCode)
      const prepayId = await createWechatJsapiOrder(config, {
        description: buildPayDescription(workOrder.code, checkout.payment.code),
        outTradeNo: checkout.payment.code,
        totalFen: yuanToFen(checkout.payment.totalAmount),
        openId,
        notifyUrl: buildNotifyUrl(request, user.companyId),
      })

      return NextResponse.json({
        success: true,
        data: {
          payment: checkout.payment,
          wechatPayParams: buildMiniProgramPayParams(config, prepayId),
        },
      })
    } catch (e) {
      console.error('[work-order-fee-checkout]', e)
      return NextResponse.json(
        { success: false, message: normalizeErrorMessage(e) },
        { status: 400 }
      )
    }
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
