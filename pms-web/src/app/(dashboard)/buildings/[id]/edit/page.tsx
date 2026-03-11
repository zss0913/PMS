import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BuildingForm } from '@/components/buildings/BuildingForm'

export default async function EditBuildingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/buildings')
  const { id } = await params
  const buildingId = parseInt(id, 10)
  if (isNaN(buildingId)) redirect('/buildings')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">编辑楼宇</h1>
      <BuildingForm mode="edit" id={buildingId} />
    </div>
  )
}
