import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BuildingForm } from '@/components/buildings/BuildingForm'

export default async function NewBuildingPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/buildings')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">新增楼宇</h1>
      <BuildingForm mode="new" />
    </div>
  )
}
