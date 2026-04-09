/**
 * 纯函数权限判断，供客户端使用；禁止在此文件引用 Prisma / server-only 模块。
 */
import { menuButtonKey } from '@/lib/menu-config'

export type ResolvedWebPermissions = {
  /** 平台超级管理员 JWT */
  isPlatformSuperAdmin: boolean
  /** 物业公司系统管理员角色（code=admin） */
  isCompanyAdminRole: boolean
  /** 不限制菜单（含未配置菜单权限的旧角色） */
  allMenus: boolean
  allowedMenuIds: number[] | null
  /** null = 未配置按钮限制，视为拥有全部按钮（在可访问菜单下） */
  allButtons: boolean
  allowedButtonKeys: string[] | null
}

/** 根据已解析的权限判断某按钮是否可用 */
export function permissionAllows(
  p: ResolvedWebPermissions,
  menuId: number,
  action: string
): boolean {
  if (p.isPlatformSuperAdmin || p.isCompanyAdminRole) return true

  if (p.allowedMenuIds && !p.allowedMenuIds.includes(menuId)) return false

  if (p.allButtons) return true

  const key = menuButtonKey(menuId, action)
  return !!p.allowedButtonKeys?.includes(key)
}

export function menuAllowed(p: ResolvedWebPermissions, menuId: number): boolean {
  if (p.isPlatformSuperAdmin || p.isCompanyAdminRole) return true
  if (!p.allowedMenuIds) return true
  return p.allowedMenuIds.includes(menuId)
}
