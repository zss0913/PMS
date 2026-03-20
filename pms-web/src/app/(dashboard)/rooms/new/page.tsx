import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { RoomForm } from '@/components/rooms/RoomForm'

export default async function NewRoomPage({
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
  const { buildingId: q } = await searchParams
  const bid = q ? parseInt(q, 10) : NaN
  const defaultBuildingId =
    !isNaN(bid) && buildings.some((b) => b.id === bid) ? bid : undefined

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">新增房源</h1>
      <RoomForm mode="new" buildings={buildings} defaultBuildingId={defaultBuildingId} />
    </div>
  )
}
