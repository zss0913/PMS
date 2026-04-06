import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { completeWorkOrderFeePayment } from '@/lib/mp-work-order-fee-pay'
import { getWechatPayConfig, parseWechatPayNotify } from '@/lib/wechat-pay'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const rawBody = await request.text()
  try {
    const { companyId } = await params
    const parsedCompanyId = parseInt(companyId, 10)
    if (isNaN(parsedCompanyId)) {
      return NextResponse.json({ code: 'FAIL', message: '无效公司ID' }, { status: 400 })
    }

    const company = await prisma.company.findUnique({
      where: { id: parsedCompanyId },
      select: {
        id: true,
        appId: true,
        appSecret: true,
        wechatMchId: true,
        wechatMchSerialNo: true,
        wechatApiV3Key: true,
        wechatPrivateKeyPem: true,
      },
    })
    if (!company) {
      return NextResponse.json({ code: 'FAIL', message: '公司不存在' }, { status: 404 })
    }

    const config = getWechatPayConfig(company)
    const signature = request.headers.get('Wechatpay-Signature') || ''
    const timestamp = request.headers.get('Wechatpay-Timestamp') || ''
    const nonce = request.headers.get('Wechatpay-Nonce') || ''
    const serial = request.headers.get('Wechatpay-Serial') || ''
    if (!signature || !timestamp || !nonce || !serial) {
      return NextResponse.json({ code: 'FAIL', message: '缺少微信支付签名头' }, { status: 400 })
    }

    const { resource } = await parseWechatPayNotify(config, {
      rawBody,
      signature,
      timestamp,
      nonce,
      serial,
    })

    if (resource.appid !== config.appId || resource.mchid !== config.mchId) {
      return NextResponse.json({ code: 'FAIL', message: '商户信息不匹配' }, { status: 400 })
    }

    if (resource.trade_state !== 'SUCCESS') {
      return NextResponse.json({ code: 'SUCCESS', message: '忽略非成功支付通知' })
    }

    const payment = await prisma.payment.findUnique({
      where: { code: resource.out_trade_no },
    })
    if (!payment || payment.companyId !== parsedCompanyId) {
      return NextResponse.json({ code: 'FAIL', message: '缴费单不存在' }, { status: 404 })
    }

    const totalFen = Number(resource.amount?.total || 0)
    const expectedFen = Math.round(Number(payment.totalAmount) * 100)
    if (totalFen !== expectedFen) {
      return NextResponse.json({ code: 'FAIL', message: '支付金额不匹配' }, { status: 400 })
    }

    const result = await completeWorkOrderFeePayment(prisma, {
      paymentId: payment.id,
      companyId: parsedCompanyId,
      tenantIds: [payment.tenantId],
      user: {
        id: 0,
        phone: '',
        name: '微信支付回调',
        companyId: parsedCompanyId,
        type: 'tenant',
        relations: [],
      },
      gatewayTradeNo: resource.transaction_id || null,
    })

    if (!result.ok) {
      return NextResponse.json({ code: 'FAIL', message: result.message }, { status: result.status })
    }

    return NextResponse.json({ code: 'SUCCESS', message: '成功' })
  } catch (e) {
    console.error('[wechat-pay-notify]', e)
    return NextResponse.json({ code: 'FAIL', message: e instanceof Error ? e.message : '服务器错误' }, { status: 500 })
  }
}
