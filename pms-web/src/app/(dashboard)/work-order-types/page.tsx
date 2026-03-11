import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { WorkOrderTypeList } from '@/components/work-order-types/WorkOrderTypeList'

export default async function WorkOrderTypesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const isSuperAdmin = user.companyId === 0

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">工单类型</h1>
      <WorkOrderTypeList isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
