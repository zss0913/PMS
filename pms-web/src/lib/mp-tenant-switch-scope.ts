import type { TenantUserWithLogin } from '@/lib/mp-tenant-token'

/** 当前账号已关联的租客主体 id */
export function tenantIdsOfUser(u: { relations: { tenantId: number }[] }): Set<number> {
  return new Set(u.relations.map((r) => r.tenantId))
}

/** 是否与当前账号至少共享一个租客（可互相切换） */
export function canSwitchBetween(
  current: { relations: { tenantId: number }[] },
  other: { relations: { tenantId: number }[] }
): boolean {
  if (other.relations.length === 0) return false
  const mine = tenantIdsOfUser(current)
  if (mine.size === 0) return false
  return other.relations.some((r) => mine.has(r.tenantId))
}

export function labelsForSharedTenants(
  u: TenantUserWithLogin,
  myTenantIds: Set<number>
): string {
  const names = u.relations
    .filter((r) => myTenantIds.has(r.tenantId))
    .map((r) => r.tenant.companyName)
  return names.length > 0 ? names.join('、') : ''
}
