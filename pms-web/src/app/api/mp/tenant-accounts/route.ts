import { NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { tenantLoginInclude, type TenantUserWithLogin } from '@/lib/mp-tenant-token'
import {
  canSwitchBetween,
  labelsForSharedTenants,
  tenantIdsOfUser,
} from '@/lib/mp-tenant-switch-scope'

/**
 * 可切换的租客端账号：仅包含与当前账号「至少共享一个租客主体」且已关联租客的账号。
 * 无关联租客、或与当前账号无共同租客的同手机号账号不展示。
 */
export async function GET(request: Request) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const me = await prisma.tenantUser.findFirst({
    where: { id: user.id, status: 'active' },
    include: tenantLoginInclude,
  })
  if (!me) {
    return NextResponse.json({ success: false, message: '用户不存在' }, { status: 404 })
  }

  const myTenantIds = tenantIdsOfUser(me)

  const rows = await prisma.tenantUser.findMany({
    where: { phone: user.phone, status: 'active' },
    include: tenantLoginInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  let eligible: TenantUserWithLogin[]
  if (myTenantIds.size === 0) {
    // 当前账号未关联任何租客：仅返回自己，不提供切换
    eligible = [me]
  } else {
    eligible = rows.filter((u) => u.id === me.id || canSwitchBetween(me, u))
  }

  const list = eligible.map((u) => {
    const sharedLabels =
      myTenantIds.size > 0 ? labelsForSharedTenants(u, myTenantIds) : ''
    const allLabels =
      u.relations.length > 0
        ? u.relations.map((r) => r.tenant.companyName).join('、')
        : ''
    return {
      id: u.id,
      name: u.name,
      companyId: u.companyId,
      companyName: u.company.name,
      tenantLabels: sharedLabels || allLabels || '-',
      isCurrent: u.id === me.id,
    }
  })

  return NextResponse.json({ success: true, data: list })
}
