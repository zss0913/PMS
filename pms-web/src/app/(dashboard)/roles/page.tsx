import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { RoleList } from '@/components/roles/RoleList'

export default async function RolesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const isSuperAdmin = user.companyId === 0
  const companies = isSuperAdmin
    ? await prisma.company.findMany({
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      })
    : []

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">角色管理</h1>
      <RoleList isSuperAdmin={isSuperAdmin} companies={companies} />
    </div>
  )
}
