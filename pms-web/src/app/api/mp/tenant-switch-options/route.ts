import { NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tenantLoginInclude } from '@/lib/mp-tenant-token'

type TenantSwitchOption = {
  tenantUserId: number
  tenantId: number
  buildingId: number
  tenantName: string
  propertyCompanyName: string
  accountName: string
  isCurrent: boolean
}

/**
 * 当前登录手机号下，所有「已关联租客主体」的可切换项（跨租客账号、跨租客公司）。
 * 用于租客端个人中心统一切换入口。
 */
export async function GET(request: Request) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const jwtRels = user.relations ?? []

  const rows = await prisma.tenantUser.findMany({
    where: { phone: user.phone, status: 'active' },
    include: tenantLoginInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const data: TenantSwitchOption[] = []

  for (const u of rows) {
    for (const r of u.relations) {
      const isCurrent =
        u.id === user.id &&
        jwtRels.some(
          (jr) => jr.tenantId === r.tenantId && jr.buildingId === r.buildingId
        )
      data.push({
        tenantUserId: u.id,
        tenantId: r.tenantId,
        buildingId: r.buildingId,
        tenantName: r.tenant.companyName,
        propertyCompanyName: u.company.name,
        accountName: u.name,
        isCurrent,
      })
    }
  }

  return NextResponse.json({ success: true, data })
}
