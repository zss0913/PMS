import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InspectionPointList } from '@/components/inspection-points/InspectionPointList'

export default async function InspectionPointsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">巡检点</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        维护巡检点位、关联设备与各类 NFC；启用前须绑定工程/安保/设备/绿化四类 NFC。禁用后新建巡检计划不可选，已生成计划不受影响。
      </p>
      <InspectionPointList />
    </div>
  )
}
