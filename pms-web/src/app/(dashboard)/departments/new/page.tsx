import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DepartmentForm } from '@/components/departments/DepartmentForm'

export default async function NewDepartmentPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/departments')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">新增部门</h1>
      <DepartmentForm mode="new" />
    </div>
  )
}
