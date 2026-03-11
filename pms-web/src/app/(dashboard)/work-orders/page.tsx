import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { WorkOrderList } from '@/components/work-orders/WorkOrderList'

export default async function WorkOrdersPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">工单管理</h1>
      <WorkOrderList />
    </div>
  )
}
