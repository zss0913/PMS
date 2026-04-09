import { Suspense } from 'react'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InspectionRecordList } from '@/components/inspection-records/InspectionRecordList'

export default async function InspectionRecordsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const isSuperAdmin = user.companyId === 0
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">巡检记录</h1>
      <Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
            加载中…
          </div>
        }
      >
        <InspectionRecordList isSuperAdmin={isSuperAdmin} />
      </Suspense>
    </div>
  )
}
