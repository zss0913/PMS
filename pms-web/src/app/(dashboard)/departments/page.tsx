import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DepartmentList } from '@/components/departments/DepartmentList'

export default async function DepartmentsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const isSuperAdmin = user.companyId === 0
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">部门管理</h1>
      <DepartmentList isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
