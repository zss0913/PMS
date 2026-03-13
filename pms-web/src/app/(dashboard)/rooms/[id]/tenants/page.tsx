import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { RoomTenantList } from '@/components/rooms/RoomTenantList'

export default async function RoomTenantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')

  const { id } = await params
  const roomId = parseInt(id, 10)
  if (isNaN(roomId)) notFound()

  return (
    <div className="p-6">
      <RoomTenantList roomId={roomId} />
    </div>
  )
}
