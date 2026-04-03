import type { PrismaClient } from '@prisma/client'
import {
  findRecipientEmployeeIds,
  findRecipientEmployeeIdsForInspectionPlan,
} from '@/lib/staff-notification-recipients'
import { businessTagForInspectionType, type StaffNotificationCategory } from '@/lib/staff-notification-routing'

export async function writeStaffNotifications(
  prisma: PrismaClient,
  args: {
    companyId: number
    buildingId: number
    businessTag: string
    category: StaffNotificationCategory
    entityId: number
    title: string
    summary?: string | null
  }
): Promise<void> {
  const { companyId, buildingId, businessTag, category, entityId, title, summary } = args

  const entityType = category
  const recipientIds = await findRecipientEmployeeIds(prisma, {
    companyId,
    buildingId,
    businessTag,
  })

  if (recipientIds.length === 0) {
    console.warn(
      '[staff-notification] no recipients',
      JSON.stringify({ companyId, buildingId, businessTag, category, entityId })
    )
    return
  }

  try {
    await prisma.staffNotification.createMany({
      data: recipientIds.map((employeeId) => ({
        companyId,
        employeeId,
        category,
        entityType,
        entityId,
        buildingId,
        title,
        summary: summary ?? null,
      })),
      skipDuplicates: true,
    })
  } catch (err) {
    console.error(
      '[staff-notification] createMany failed（请执行 prisma migrate / db push 并 prisma generate）',
      err
    )
  }
}

export async function writeInspectionTaskNotifications(
  prisma: PrismaClient,
  args: {
    companyId: number
    taskId: number
    planName: string
    taskCode: string
    inspectionType: string
    planUserIds: string | null | undefined
  }
): Promise<void> {
  const businessTag = businessTagForInspectionType(args.inspectionType)
  const recipientIds = await findRecipientEmployeeIdsForInspectionPlan(prisma, {
    companyId: args.companyId,
    businessTag,
    planUserIdsJson: args.planUserIds,
  })

  if (recipientIds.length === 0) {
    console.warn(
      '[staff-notification] inspection no recipients',
      JSON.stringify({
        companyId: args.companyId,
        taskId: args.taskId,
        businessTag,
      })
    )
    return
  }

  try {
    await prisma.staffNotification.createMany({
      data: recipientIds.map((employeeId) => ({
        companyId: args.companyId,
        employeeId,
        category: 'inspection_task' as const,
        entityType: 'inspection_task',
        entityId: args.taskId,
        buildingId: null,
        title: `巡检任务：${args.planName}`,
        summary: `${args.taskCode} · ${args.inspectionType}`,
      })),
      skipDuplicates: true,
    })
  } catch (err) {
    console.error('[staff-notification] inspection createMany failed', err)
  }
}

