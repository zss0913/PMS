import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { RoomForm } from '@/components/rooms/RoomForm'

export default async function EditRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const { returnTo } = await searchParams
  const id = parseInt((await params).id, 10)
  if (isNaN(id)) notFound()
  const companyId = user.companyId
  const room = await prisma.room.findFirst({
    where: companyId > 0 ? { id, companyId } : { id },
    include: { building: true, floor: true },
  })
  if (!room) notFound()
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
  const initialData = {
    name: room.name,
    roomNumber: room.roomNumber,
    area: String(Number(room.area)),
    buildingId: room.buildingId,
    floorId: room.floorId,
    type: room.type,
    status: room.status,
    leasingStatus: room.leasingStatus,
  }
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">编辑房源</h1>
      <RoomForm
        mode="edit"
        id={id}
        buildings={buildings}
        initialData={initialData}
        returnTo={returnTo}
      />
    </div>
  )
}
