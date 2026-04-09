import type { Prisma } from '@prisma/client'

/**
 * 将工单与维保记录同步：先解除本记录不再关联的工单，再把所选工单指向本记录。
 * 每条工单最多关联一条维保记录；若工单已关联其他记录则抛错。
 */
export async function syncMaintenanceRecordWorkOrders(
  tx: Prisma.TransactionClient,
  companyId: number,
  recordId: number,
  workOrderIds: number[]
) {
  const uniq = [...new Set(workOrderIds)]

  await tx.workOrder.updateMany({
    where: {
      deviceMaintenanceRecordId: recordId,
      companyId,
      ...(uniq.length > 0 ? { id: { notIn: uniq } } : {}),
    },
    data: { deviceMaintenanceRecordId: null },
  })

  if (uniq.length === 0) return

  const rows = await tx.workOrder.findMany({
    where: { id: { in: uniq }, companyId },
    select: { id: true, code: true, deviceMaintenanceRecordId: true },
  })
  if (rows.length !== uniq.length) {
    throw new Error('部分工单不存在或无权访问')
  }
  for (const wo of rows) {
    if (wo.deviceMaintenanceRecordId != null && wo.deviceMaintenanceRecordId !== recordId) {
      throw new Error(`工单 ${wo.code} 已被其他维保记录关联，请刷新后重选`)
    }
  }
  await tx.workOrder.updateMany({
    where: { id: { in: uniq }, companyId },
    data: { deviceMaintenanceRecordId: recordId },
  })
}
