import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveTenantIds } from '@/lib/mp-effective-tenant-ids'
import { createTenantBatchBillCheckout } from '@/lib/mp-bill-tenant-pay'

const bodySchema = z.object({
  billIds: z.array(z.number().int().min(1)).min(2),
  channel: z.enum(['wechat', 'alipay']),
})

/** 多笔账单合并发起在线支付（pending） */
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

    const payer =
      [user.name, user.phone].filter((x) => x && String(x).trim()).join(' ') || '租客'

    const r = await createTenantBatchBillCheckout(prisma, {
      billIds: parsed.billIds,
      companyId: user.companyId,
      tenantIds,
      channel: parsed.channel,
      payer,
      user,
    })

    if (!r.ok) {
      return NextResponse.json({ success: false, message: r.message }, { status: r.status })
    }

    return NextResponse.json({
      success: true,
      data: {
        payment: r.payment,
        nextStep: 'POST /api/mp/bills/checkout-complete',
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
