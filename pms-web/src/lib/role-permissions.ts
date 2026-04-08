import type { AuthUser } from '@/lib/auth'
import { COMPANY_ADMIN_ROLE_CODE, MENU_OPTIONS, MENU_BUTTON_OPTIONS, allMenuButtonKeys, menuButtonKey } from '@/lib/menu-config'
import { prisma } from '@/lib/prisma'
import type { ResolvedWebPermissions } from '@/lib/role-permissions-guards'

export type { ResolvedWebPermissions } from '@/lib/role-permissions-guards'
export { menuAllowed, permissionAllows } from '@/lib/role-permissions-guards'

function parseMenuIds(raw: string | null | undefined): number[] | null {
  if (raw == null || raw === '') return null
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return null
    return arr.map((x) => Number(x)).filter((n) => !Number.isNaN(n))
  } catch {
    return null
  }
}

function parseButtonKeys(raw: string | null | undefined): string[] | null {
  if (raw == null || raw === '') return null
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return null
    return arr.filter((x): x is string => typeof x === 'string')
  } catch {
    return null
  }
}

export async function resolveWebPermissions(user: AuthUser): Promise<ResolvedWebPermissions> {
  if (user.type === 'super_admin') {
    return {
      isPlatformSuperAdmin: true,
      isCompanyAdminRole: false,
      allMenus: true,
      allowedMenuIds: null,
      allButtons: true,
      allowedButtonKeys: null,
    }
  }

  if (user.type !== 'employee' || !user.roleId) {
    return {
      isPlatformSuperAdmin: false,
      isCompanyAdminRole: false,
      allMenus: true,
      allowedMenuIds: null,
      allButtons: true,
      allowedButtonKeys: null,
    }
  }

  const role = await prisma.role.findUnique({
    where: { id: user.roleId },
    select: {
      code: true,
      menuIds: true,
      buttonPermissionKeys: true,
    },
  })

  if (!role) {
    return {
      isPlatformSuperAdmin: false,
      isCompanyAdminRole: false,
      allMenus: true,
      allowedMenuIds: null,
      allButtons: true,
      allowedButtonKeys: null,
    }
  }

  if (role.code === COMPANY_ADMIN_ROLE_CODE) {
    return {
      isPlatformSuperAdmin: false,
      isCompanyAdminRole: true,
      allMenus: true,
      allowedMenuIds: null,
      allButtons: true,
      allowedButtonKeys: null,
    }
  }

  const menuIds = parseMenuIds(role.menuIds)
  const allMenuIdSet = new Set(MENU_OPTIONS.map((m) => m.id))
  const allMenus =
    !menuIds ||
    menuIds.length === 0 ||
    menuIds.length >= allMenuIdSet.size

  const rawBtn = role.buttonPermissionKeys
  const explicitButtons = !(rawBtn == null || rawBtn === '')
  const buttonKeys = explicitButtons ? parseButtonKeys(rawBtn) ?? [] : null

  return {
    isPlatformSuperAdmin: false,
    isCompanyAdminRole: false,
    allMenus,
    allowedMenuIds: allMenus ? null : menuIds,
    allButtons: !explicitButtons,
    allowedButtonKeys: explicitButtons ? buttonKeys : null,
  }
}

export { parseButtonKeys, parseMenuIds, allMenuButtonKeys, menuButtonKey, MENU_BUTTON_OPTIONS }
