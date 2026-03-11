import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InspectionPlanList } from '@/components/inspection-plans/InspectionPlanList'

export default async function InspectionPlansPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">巡检计划</h1>
      <InspectionPlanList />
    </div>
  )
}
