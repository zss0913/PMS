import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DeviceList } from '@/components/devices/DeviceList'

export default async function DevicesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const isSuperAdmin = user.companyId === 0

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">设备台账</h1>
      <DeviceList isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
