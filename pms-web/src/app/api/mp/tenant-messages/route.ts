import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveTenantIds } from '@/lib/mp-effective-tenant-ids'

/** 租客端：物业下发的催缴等消息（TenantAppMessage） */
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ success: true, list: [] })
    }

    const rows = await prisma.tenantAppMessage.findMany({
      where: {
        companyId: user.companyId,
        tenantId: { in: tenantIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const list = rows.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      title: m.title,
      content: m.content,
      billIdsJson: m.billIdsJson,
      createdAt: m.createdAt.toISOString(),
    }))

    return NextResponse.json({ success: true, list })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
