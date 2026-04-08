import { prisma } from '@/lib/prisma'

export type MpClientKind = 'tenant' | 'staff'

function envTenantAppId() {
  return (process.env.WECHAT_MP_TENANT_APP_ID || '').trim()
}

function envTenantAppSecret() {
  return (process.env.WECHAT_MP_TENANT_APP_SECRET || '').trim()
}

function envStaffAppId() {
  return (process.env.WECHAT_MP_STAFF_APP_ID || '').trim()
}

function envStaffAppSecret() {
  return (process.env.WECHAT_MP_STAFF_APP_SECRET || '').trim()
}

/** 库内非空字段优先于环境变量（便于超管页覆盖） */
export async function resolvePlatformMpCredentials(
  kind: MpClientKind
): Promise<{ appId: string; appSecret: string }> {
  const row = await prisma.platformMpSettings.findUnique({ where: { id: 1 } })
  if (kind === 'tenant') {
    const appId = (row?.tenantAppId || '').trim() || envTenantAppId()
    const appSecret = (row?.tenantAppSecret || '').trim() || envTenantAppSecret()
    return { appId, appSecret }
  }
  const appId = (row?.staffAppId || '').trim() || envStaffAppId()
  const appSecret = (row?.staffAppSecret || '').trim() || envStaffAppSecret()
  return { appId, appSecret }
}

/** 支付回调校验：允许租客端或员工端 AppId（若两套相同则去重） */
export async function resolveAllPlatformAppIds(): Promise<string[]> {
  const [t, s] = await Promise.all([
    resolvePlatformMpCredentials('tenant'),
    resolvePlatformMpCredentials('staff'),
  ])
  const set = new Set<string>()
  if (t.appId) set.add(t.appId)
  if (s.appId) set.add(s.appId)
  return [...set]
}

export type PlatformMpSettingsView = {
  tenantAppId: string
  staffAppId: string
  tenantAppSecretConfigured: boolean
  staffAppSecretConfigured: boolean
  tenantAppIdFromDb: boolean
  staffAppIdFromDb: boolean
  tenantAppSecretFromDb: boolean
  staffAppSecretFromDb: boolean
}

export async function getPlatformMpSettingsView(): Promise<PlatformMpSettingsView> {
  const row = await prisma.platformMpSettings.findUnique({ where: { id: 1 } })
  const tenantIdDb = !!(row?.tenantAppId || '').trim()
  const staffIdDb = !!(row?.staffAppId || '').trim()
  const tenantSecDb = !!(row?.tenantAppSecret || '').trim()
  const staffSecDb = !!(row?.staffAppSecret || '').trim()

  const tenantAppId = (row?.tenantAppId || '').trim() || envTenantAppId()
  const staffAppId = (row?.staffAppId || '').trim() || envStaffAppId()

  return {
    tenantAppId,
    staffAppId,
    tenantAppSecretConfigured: tenantSecDb || !!envTenantAppSecret(),
    staffAppSecretConfigured: staffSecDb || !!envStaffAppSecret(),
    tenantAppIdFromDb: tenantIdDb,
    staffAppIdFromDb: staffIdDb,
    tenantAppSecretFromDb: tenantSecDb,
    staffAppSecretFromDb: staffSecDb,
  }
}
