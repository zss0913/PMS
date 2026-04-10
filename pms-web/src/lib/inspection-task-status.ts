import type { PrismaClient } from '@prisma/client'
import { normalizeInspectionBizTagId, parseCheckItemsJson } from '@/lib/inspection-check-items'

/** 将历史「执行中」与新产品「巡检中」统一 */
export function normalizeInspectionTaskStatus(status: string): string {
  if (status === '执行中') return '巡检中'
  return status
}

export async function syncInspectionTaskProgress(
  prisma: PrismaClient,
  taskId: number
): Promise<void> {
  const task = await prisma.inspectionTask.findUnique({ where: { id: taskId } })
  if (!task) return

  const items = parseCheckItemsJson(task.checkItems)
  if (items.length === 0) return

  const records = await prisma.inspectionRecord.findMany({
    where: { taskId },
    select: { tagId: true },
  })
  const doneNorm = new Set(records.map((r) => normalizeInspectionBizTagId(r.tagId)))

  const tags = await prisma.nfcTag.findMany({
    where: { id: { in: items.map((i) => i.nfcTagId) } },
    select: { id: true, tagId: true },
  })
  const businessIdByPk = new Map(tags.map((t) => [t.id, t.tagId]))

  let doneCount = 0
  for (const it of items) {
    const bid = businessIdByPk.get(it.nfcTagId)
    if (bid && doneNorm.has(normalizeInspectionBizTagId(bid))) doneCount += 1
  }

  const rawStatus = normalizeInspectionTaskStatus(task.status)
  if (rawStatus === '已完成' || rawStatus === '已逾期') return

  let nextStatus = rawStatus
  let startedAt = task.startedAt
  let completedAt = task.completedAt
  let completedBy = task.completedBy

  if (doneCount === 0) {
    nextStatus = '待执行'
    startedAt = null
    completedAt = null
    completedBy = null
  } else if (doneCount < items.length) {
    nextStatus = '巡检中'
    if (!startedAt) startedAt = new Date()
    completedAt = null
    completedBy = null
  } else {
    nextStatus = '已完成'
    if (!startedAt) startedAt = new Date()
    const last = await prisma.inspectionRecord.findFirst({
      where: { taskId },
      orderBy: { checkedAt: 'desc' },
      select: { checkedAt: true, checkedBy: true },
    })
    completedAt = last?.checkedAt ?? new Date()
    completedBy = last?.checkedBy ?? null
  }

  if (
    nextStatus !== task.status ||
    startedAt?.getTime() !== task.startedAt?.getTime() ||
    completedAt?.getTime() !== task.completedAt?.getTime() ||
    completedBy !== task.completedBy
  ) {
    await prisma.inspectionTask.update({
      where: { id: taskId },
      data: {
        status: nextStatus,
        startedAt,
        completedAt,
        completedBy,
      },
    })
  }
}
