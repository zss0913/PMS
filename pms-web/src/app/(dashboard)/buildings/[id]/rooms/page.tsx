import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'
import { RoomList } from '@/components/rooms/RoomList'

export default async function BuildingRoomsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const { id } = await params
  const buildingId = parseInt(id, 10)
  if (isNaN(buildingId)) redirect('/buildings')

  const where =
    user.companyId > 0 ? { id: buildingId, companyId: user.companyId } : { id: buildingId }
  const building = await prisma.building.findFirst({
    where,
    select: { id: true, name: true },
  })
  if (!building) notFound()

  const buildings = [{ id: building.id, name: building.name }]

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <AppLink
          href={`/buildings/${buildingId}`}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回楼宇详情
        </AppLink>
      </div>
      <h1 className="text-2xl font-bold mb-1">{building.name} · 房源列表</h1>
      <p className="text-sm text-slate-500 mb-6">仅展示本楼宇下的房源，与「房源管理」全列表无关。</p>
      <RoomList
        buildings={buildings}
        initialBuildingId={building.id}
        lockedBuildingId={building.id}
      />
    </div>
  )
}
