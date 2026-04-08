'use client'

import type { ReactNode } from 'react'
import { useRolePermissions } from '@/hooks/useRolePermissions'

export function PermissionGate({
  menuId,
  action,
  children,
}: {
  menuId: number
  action: string
  children: ReactNode
}) {
  const { can } = useRolePermissions()
  if (!can(menuId, action)) return null
  return <>{children}</>
}
