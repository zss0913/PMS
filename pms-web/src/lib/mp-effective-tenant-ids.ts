import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 与账单等接口一致：JWT 关系与库内关系求交集，得到当前账号可见的 tenantId 列表 */
export async function resolveEffectiveTenantIds(user: AuthUser): Promise<number[]> {
  if (user.type !== 'tenant') return []
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: user.id },
    select: {
      relations: { select: { tenantId: true, buildingId: true } },
    },
  })
  const dbRelations = tenantUser?.relations ?? []
  if (dbRelations.length === 0) return []
  const jwtRelations = user.relations ?? []
  if (jwtRelations.length === 0) {
    return Array.from(new Set(dbRelations.map((r) => r.tenantId)))
  }
  const scoped = dbRelations.filter((r) =>
    jwtRelations.some(
      (jr) => jr.tenantId === r.tenantId && jr.buildingId === r.buildingId
    )
  )
  const effective = scoped.length > 0 ? scoped : dbRelations
  return Array.from(new Set(effective.map((r) => r.tenantId)))
}
