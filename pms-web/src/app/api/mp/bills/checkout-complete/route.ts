import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveTenantIds } from '@/lib/mp-effective-tenant-ids'
import { completeTenantBillOnlinePayment } from '@/lib/mp-bill-tenant-pay'

const bodySchema = z.object({
  paymentId: z.number().int().min(1),
  /** 未接网关时可选模拟流水号 */
  gatewayTradeNo: z.string().max(128).optional(),
})

/** 模拟或网关回调后确认支付成功，入账账单 */
export async function POST(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const tenantIds = await resolveEffectiveTenantIds(user)
    if (tenantIds.length === 0) {
      return NextResponse.json({ success: false, message: '无租客关联' }, { status: 400 })
    }

    const json = await request.json()
    const parsed = bodySchema.parse(json)

    const r = await completeTenantBillOnlinePayment(prisma, {
      paymentId: parsed.paymentId,
      companyId: user.companyId,
      tenantIds,
      user,
      gatewayTradeNo: parsed.gatewayTradeNo ?? null,
    })

    if (!r.ok) {
      return NextResponse.json({ success: false, message: r.message }, { status: r.status })
    }

    return NextResponse.json({ success: true, message: '支付已确认' })
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
