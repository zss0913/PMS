import { Suspense } from 'react'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InspectionTaskList } from '@/components/inspection-tasks/InspectionTaskList'

export default async function InspectionTasksPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">巡检任务</h1>
      <Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
            加载中…
          </div>
        }
      >
        <InspectionTaskList />
      </Suspense>
    </div>
  )
}
