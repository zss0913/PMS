import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { RoomList } from '@/components/rooms/RoomList'

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ buildingId?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const companyId = user.companyId
  const buildings = companyId > 0
    ? await prisma.building.findMany({
        where: { companyId },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      })
    : await prisma.building.findMany({
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      })
  const { buildingId } = await searchParams
  const initialBuildingId = buildingId ? parseInt(buildingId, 10) : undefined
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">房源管理</h1>
      <RoomList buildings={buildings} initialBuildingId={isNaN(initialBuildingId ?? NaN) ? undefined : initialBuildingId} />
    </div>
  )
}
