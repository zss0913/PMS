import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { fetchWorkOrderActivityLogs } from '@/lib/work-order-activity-log-db'
import { WorkOrderDetail } from '@/components/work-orders/WorkOrderDetail'

export default async function WorkOrderDetailPage({
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
    include: {
      building: { select: { id: true, name: true } },
      room: { select: { id: true, name: true, roomNumber: true } },
      tenant: { select: { id: true, companyName: true } },
      assignedEmployee: { select: { id: true, name: true } },
    },
  })

  if (!workOrder) notFound()

  const [employees, activityLogs] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true, phone: true },
      orderBy: { id: 'asc' },
    }),
    fetchWorkOrderActivityLogs(prisma, user.companyId, workOrderId),
  ])

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
        <h1 className="text-2xl font-bold">工单详情 - {workOrder.code}</h1>
      </div>
      <WorkOrderDetail
        workOrder={{
          id: workOrder.id,
          code: workOrder.code,
          title: workOrder.title,
          type: workOrder.type,
          source: workOrder.source,
          description: workOrder.description,
          images: workOrder.images,
          location: workOrder.location,
          status: workOrder.status,
          facilityScope: workOrder.facilityScope,
          feeNoticeAcknowledged: workOrder.feeNoticeAcknowledged,
          feeRemark: workOrder.feeRemark,
          feeConfirmedAt: workOrder.feeConfirmedAt?.toISOString() ?? null,
          building: workOrder.building,
          room: workOrder.room,
          tenant: workOrder.tenant,
          assignedTo: workOrder.assignedTo,
          assignedEmployee: workOrder.assignedEmployee,
          assignedAt: workOrder.assignedAt?.toISOString() ?? null,
          respondedAt: workOrder.respondedAt?.toISOString() ?? null,
          completedAt: workOrder.completedAt?.toISOString() ?? null,
          evaluatedAt: workOrder.evaluatedAt?.toISOString() ?? null,
          createdAt: workOrder.createdAt.toISOString(),
          updatedAt: workOrder.updatedAt.toISOString(),
        }}
        employees={employees}
        activityLogs={activityLogs}
      />
    </div>
  )
}
