import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CompanyList } from '@/components/companies/CompanyList'

export default async function CompaniesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.type !== 'super_admin') redirect('/')
  const companies = await prisma.company.findMany({
    include: {
      _count: {
        select: { employees: true, buildings: true, rooms: true },
      },
    },
    orderBy: { id: 'asc' },
  })
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">物业公司管理</h1>
      <CompanyList companies={companies} />
    </div>
  )
}
