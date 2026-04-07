import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function resolveEffectiveTenantIds(
  userId: number,
  jwtRelations: { tenantId: number; buildingId: number }[] = []
) {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: userId },
    select: {
      relations: {
        select: { tenantId: true, buildingId: true },
      },
    },
  })
  const dbRelations = tenantUser?.relations ?? []
  if (dbRelations.length === 0) {
    return []
  }
  if (jwtRelations.length === 0) {
    return Array.from(new Set(dbRelations.map((r) => r.tenantId)))
  }
  const scoped = dbRelations.filter((r) =>
    jwtRelations.some((jr) => jr.tenantId === r.tenantId && jr.buildingId === r.buildingId)
  )
  const effective = scoped.length > 0 ? scoped : dbRelations
  return Array.from(new Set(effective.map((r) => r.tenantId)))
}

/** 租客端：当前可见账单的费用类型去重列表（用于筛选） */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json({ success: false, message: '未登录或无权限' }, { status: 401 })
  }
  const tenantIds = await resolveEffectiveTenantIds(user.id, user.relations ?? [])
  if (tenantIds.length === 0) {
    return NextResponse.json({ success: true, feeTypes: [] as string[] })
  }

  const rows = await prisma.bill.findMany({
    where: {
      tenantId: { in: tenantIds },
      companyId: user.companyId,
    },
    select: { feeType: true },
    distinct: ['feeType'],
  })

  const feeTypes = rows
    .map((r) => r.feeType)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return NextResponse.json({ success: true, feeTypes })
}
