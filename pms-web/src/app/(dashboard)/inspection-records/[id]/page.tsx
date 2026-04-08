import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InspectionRecordDetailView } from '@/components/inspection-records/InspectionRecordDetailView'
import { sanitizeDashboardReturnTo } from '@/lib/safe-return-url'

export default async function InspectionRecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/inspection-records')

  const { id } = await params
  const recordId = parseInt(id, 10)
  if (Number.isNaN(recordId) || recordId < 1) {
    redirect('/inspection-records')
  }

  const sp = await searchParams
  const rawReturn = sp.returnTo
  const returnToParam =
    typeof rawReturn === 'string' ? rawReturn : Array.isArray(rawReturn) ? rawReturn[0] : undefined
  const backHref = sanitizeDashboardReturnTo(returnToParam)
  const backLabel =
    backHref?.startsWith('/inspection-tasks') ? '返回巡检任务' : '返回巡检记录列表'

  return (
    <div className="p-6">
      <InspectionRecordDetailView
        recordId={recordId}
        backHref={backHref ?? undefined}
        backLabel={backLabel}
      />
    </div>
  )
}
