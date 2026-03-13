import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EmployeeList } from '@/components/employees/EmployeeList'

export default async function EmployeesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const companyId = user.companyId

  const [projects, departments, roles, companies] = await Promise.all([
    companyId > 0
      ? prisma.project.findMany({ where: { companyId }, select: { id: true, name: true, companyId: true } })
      : prisma.project.findMany({ select: { id: true, name: true, companyId: true } }),
    companyId > 0
      ? prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, companyId: true } })
      : prisma.department.findMany({ select: { id: true, name: true, companyId: true } }),
    companyId > 0
      ? prisma.role.findMany({ where: { companyId }, select: { id: true, name: true, companyId: true } })
      : prisma.role.findMany({ select: { id: true, name: true, companyId: true } }),
    companyId === 0 ? prisma.company.findMany({ select: { id: true, name: true } }) : [],
  ])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">员工账号</h1>
      <EmployeeList
        projects={projects}
        departments={departments}
        roles={roles}
        companies={companies}
        isSuperAdmin={companyId === 0}
      />
    </div>
  )
}
