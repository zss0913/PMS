import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DeviceMaintenanceList } from '@/components/device-maintenance/DeviceMaintenanceList'

export default async function DeviceMaintenanceRecordsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  if (user.companyId === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">设备维保记录</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
          <p className="font-medium">超级管理员账号无法管理维保记录</p>
          <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">设备维保记录</h1>
      <DeviceMaintenanceList />
    </div>
  )
}
