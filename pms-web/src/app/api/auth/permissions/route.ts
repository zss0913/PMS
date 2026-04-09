import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { resolveWebPermissions } from '@/lib/role-permissions'

export async function GET() {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const p = await resolveWebPermissions(user)
  return NextResponse.json({
    success: true,
    data: {
      isPlatformSuperAdmin: p.isPlatformSuperAdmin,
      isCompanyAdminRole: p.isCompanyAdminRole,
      allMenus: p.allMenus,
      allowedMenuIds: p.allowedMenuIds,
      allButtons: p.allButtons,
      allowedButtonKeys: p.allowedButtonKeys,
    },
  })
}
