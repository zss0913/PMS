import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import {
  findRecipientEmployeeIds,
  findRecipientEmployeeIdsForInspectionPlan,
} from '@/lib/staff-notification-recipients'
import { businessTagForInspectionType, type StaffNotificationCategory } from '@/lib/staff-notification-routing'

/** SQLite 下 createMany 无 skipDuplicates，逐条插入并忽略重复 */
async function createStaffNotificationsDedup(
  prisma: PrismaClient,
  rows: Prisma.StaffNotificationUncheckedCreateInput[]
) {
  for (const data of rows) {
    try {
      await prisma.staffNotification.create({ data })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue
      throw e
    }
  }
}

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
    await createStaffNotificationsDedup(
      prisma,
      recipientIds.map((employeeId) => ({
        companyId,
        employeeId,
        category,
        entityType,
        entityId,
        buildingId,
        title,
        summary: summary ?? null,
      }))
    )
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
    await createStaffNotificationsDedup(
      prisma,
      recipientIds.map((employeeId) => ({
        companyId: args.companyId,
        employeeId,
        category: 'inspection_task',
        entityType: 'inspection_task',
        entityId: args.taskId,
        buildingId: null,
        title: `巡检任务：${args.planName}`,
        summary: `${args.taskCode} · ${args.inspectionType}`,
      }))
    )
  } catch (err) {
    console.error('[staff-notification] inspection createMany failed', err)
  }
}

