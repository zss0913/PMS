import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DepartmentForm } from '@/components/departments/DepartmentForm'

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/departments')
  const { id } = await params
  const deptId = parseInt(id, 10)
  if (isNaN(deptId)) redirect('/departments')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">编辑部门</h1>
      <DepartmentForm mode="edit" id={deptId} />
    </div>
  )
}
