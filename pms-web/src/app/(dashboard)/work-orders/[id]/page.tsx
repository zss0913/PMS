import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeReturnPath } from '@/lib/safe-return-path'
import { WorkOrderDetailBackButton } from '@/components/work-orders/WorkOrderDetailBackButton'
import { fetchWorkOrderActivityLogs } from '@/lib/work-order-activity-log-db'
import { WorkOrderDetail } from '@/components/work-orders/WorkOrderDetail'
import { resolveWorkOrderReporter } from '@/lib/work-order-reporter'
import { parseWorkOrderImageUrls } from '@/lib/work-order'

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/')

  const { id } = await params
  const sp = await searchParams
  const rawRt = sp.returnTo
  const returnToParam =
    typeof rawRt === 'string' ? rawRt : Array.isArray(rawRt) ? rawRt[0] : undefined
  const presetReturnHref = safeReturnPath(returnToParam)

  const workOrderId = parseInt(id, 10)
  if (isNaN(workOrderId)) notFound()

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: user.companyId },
    include: {
      building: { select: { id: true, name: true } },
      room: { select: { id: true, name: true, roomNumber: true } },
      tenant: { select: { id: true, companyName: true } },
      assignedEmployee: { select: { id: true, name: true, phone: true } },
    },
  })

  if (!workOrder) notFound()

  const reporter = await resolveWorkOrderReporter(
    prisma,
    user.companyId,
    workOrder.reporterId,
    workOrder.source
  )

  let tenantForDetail = workOrder.tenant
  if (!tenantForDetail && workOrder.tenantId != null) {
    tenantForDetail = await prisma.tenant.findFirst({
      where: { id: workOrder.tenantId, companyId: user.companyId },
      select: { id: true, companyName: true },
    })
  }

  const [employees, activityLogs, workOrderFeeBillRow] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true, phone: true },
      orderBy: { id: 'asc' },
    }),
    fetchWorkOrderActivityLogs(prisma, user.companyId, workOrderId),
    prisma.bill.findFirst({
      where: {
        companyId: user.companyId,
        workOrderId,
        billSource: 'work_order_fee',
      },
      select: { id: true },
    }),
  ])

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <WorkOrderDetailBackButton presetReturnHref={presetReturnHref} />
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
          feeTotal: workOrder.feeTotal,
          feeConfirmedAt: workOrder.feeConfirmedAt?.toISOString() ?? null,
          building: workOrder.building,
          room: workOrder.room,
          tenant: tenantForDetail,
          reporter,
          assignedTo: workOrder.assignedTo,
          assignedEmployee: workOrder.assignedEmployee,
          assignedAt: workOrder.assignedAt?.toISOString() ?? null,
          respondedAt: workOrder.respondedAt?.toISOString() ?? null,
          completedAt: workOrder.completedAt?.toISOString() ?? null,
          evaluatedAt: workOrder.evaluatedAt?.toISOString() ?? null,
          completionImageUrls: parseWorkOrderImageUrls(workOrder.completionImages),
          completionRemark: workOrder.completionRemark,
          evaluationNote: workOrder.evaluationNote,
          evaluationStars: workOrder.evaluationStars,
          evaluationImageUrls: parseWorkOrderImageUrls(workOrder.evaluationImages),
          createdAt: workOrder.createdAt.toISOString(),
          updatedAt: workOrder.updatedAt.toISOString(),
          hasWorkOrderFeeBill: workOrderFeeBillRow != null,
        }}
        employees={employees}
        activityLogs={activityLogs}
      />
    </div>
  )
}
