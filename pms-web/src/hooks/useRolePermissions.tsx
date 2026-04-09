'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ResolvedWebPermissions } from '@/lib/role-permissions-guards'
import { menuAllowed, permissionAllows } from '@/lib/role-permissions-guards'

type PermPayload = {
  isPlatformSuperAdmin: boolean
  isCompanyAdminRole: boolean
  allMenus: boolean
  allowedMenuIds: number[] | null
  allButtons: boolean
  allowedButtonKeys: string[] | null
}

const defaultPermissive: ResolvedWebPermissions = {
  isPlatformSuperAdmin: false,
  isCompanyAdminRole: false,
  allMenus: true,
  allowedMenuIds: null,
  allButtons: true,
  allowedButtonKeys: null,
}

const RolePermissionsContext = createContext<{
  loaded: boolean
  permissions: ResolvedWebPermissions
  can: (menuId: number, action: string) => boolean
  canMenu: (menuId: number) => boolean
}>({
  loaded: false,
  permissions: defaultPermissive,
  can: () => true,
  canMenu: () => true,
})

export function RolePermissionsProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [permissions, setPermissions] = useState<ResolvedWebPermissions>(defaultPermissive)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/permissions', { credentials: 'include' })
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data) {
          const d = json.data as PermPayload
          setPermissions({
            isPlatformSuperAdmin: d.isPlatformSuperAdmin,
            isCompanyAdminRole: d.isCompanyAdminRole,
            allMenus: d.allMenus,
            allowedMenuIds: d.allowedMenuIds,
            allButtons: d.allButtons,
            allowedButtonKeys: d.allowedButtonKeys,
          })
        }
      } catch {
        /* 保持默认宽松，避免误伤 */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const can = useCallback(
    (menuId: number, action: string) => permissionAllows(permissions, menuId, action),
    [permissions]
  )

  const canMenu = useCallback(
    (menuId: number) => menuAllowed(permissions, menuId),
    [permissions]
  )

  const value = useMemo(
    () => ({ loaded, permissions, can, canMenu }),
    [loaded, permissions, can, canMenu]
  )

  return (
    <RolePermissionsContext.Provider value={value}>{children}</RolePermissionsContext.Provider>
  )
}

export function useRolePermissions() {
  return useContext(RolePermissionsContext)
}
