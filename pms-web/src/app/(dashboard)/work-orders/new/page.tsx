import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'
import { WorkOrderForm } from '@/components/work-orders/WorkOrderForm'

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')
  const sp = await searchParams
  const defaultSource = sp.source === '巡检发现' ? '巡检发现' : 'PC自建'

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <AppLink
          href="/work-orders"
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </AppLink>
        <h1 className="text-2xl font-bold">新建工单</h1>
      </div>
      <WorkOrderForm defaultSource={defaultSource} />
    </div>
  )
}
