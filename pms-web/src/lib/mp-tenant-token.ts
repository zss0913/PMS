import type { Prisma } from '@prisma/client'
import { createToken } from '@/lib/auth'

export const tenantLoginInclude = {
  relations: {
    include: { tenant: { select: { id: true, companyName: true } } },
  },
  company: { select: { id: true, name: true } },
} satisfies Prisma.TenantUserInclude

export type TenantUserWithLogin = Prisma.TenantUserGetPayload<{ include: typeof tenantLoginInclude }>

export function mapTenantRelationsForToken(
  relations: TenantUserWithLogin['relations']
) {
  return relations.map((r) => ({
    tenantId: r.tenantId,
    buildingId: r.buildingId,
    isAdmin: r.isAdmin,
    tenantName: r.tenant.companyName,
  }))
}

/** 仅将指定租客主体写入 Token（切换「当前所属租客」） */
export async function buildTenantTokenResponseForTenantId(
  tenantUser: TenantUserWithLogin,
  tenantId: number
) {
  const subset = tenantUser.relations.filter((r) => r.tenantId === tenantId)
  if (subset.length === 0) {
    return null
  }
  return buildTenantTokenResponse({ ...tenantUser, relations: subset })
}

export async function buildTenantTokenResponse(tenantUser: TenantUserWithLogin) {
  const relations = mapTenantRelationsForToken(tenantUser.relations)
  const token = await createToken({
    id: tenantUser.id,
    phone: tenantUser.phone,
    name: tenantUser.name,
    companyId: tenantUser.companyId,
    type: 'tenant',
    relations,
  })
  return {
    token,
    user: {
      id: tenantUser.id,
      name: tenantUser.name,
      phone: tenantUser.phone,
      type: 'tenant' as const,
      companyId: tenantUser.companyId,
      relations,
    },
  }
}
