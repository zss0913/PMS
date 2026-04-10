import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'
import { RolePermissionsProvider } from '@/hooks/useRolePermissions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  return (
    <RolePermissionsProvider>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
        <Sidebar user={user} />
        <main className="dashboard-main min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </RolePermissionsProvider>
  )
}
