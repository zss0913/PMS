import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { parseWorkOrderImageUrls } from '@/lib/work-order'
import { WorkOrderEditForm } from '@/components/work-orders/WorkOrderEditForm'

export default async function WorkOrderEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')

  const { id } = await params
  const workOrderId = parseInt(id, 10)
  if (isNaN(workOrderId)) notFound()

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: user.companyId },
  })

  if (!workOrder) notFound()

  if (['评价完成', '已取消'].includes(workOrder.status)) {
    redirect(`/work-orders/${workOrderId}`)
  }

  const imageUrls = parseWorkOrderImageUrls(workOrder.images)

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <AppLink
          href={`/work-orders/${workOrderId}`}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
          返回工单详情
        </AppLink>
        <h1 className="text-2xl font-bold">编辑工单</h1>
      </div>
      <WorkOrderEditForm
        workOrderId={workOrder.id}
        code={workOrder.code}
        title={workOrder.title}
        description={workOrder.description}
        imageUrls={imageUrls}
      />
    </div>
  )
}
