import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'
import { normalizeInspectionTaskStatus } from '@/lib/inspection-task-status'

/** 员工端：巡检任务详情（含路线检查项、楼宇、进度） */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(_request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
    )
  }

  const { id } = await params
  const taskId = parseInt(id, 10)
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ success: false, message: '无效的任务ID' }, { status: 400 })
  }

  const task = await prisma.inspectionTask.findFirst({
    where: { id: taskId, companyId: user.companyId },
    include: {
      building: { select: { id: true, name: true } },
    },
  })

  if (!task) {
    return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
  }

  let userIds: number[] = []
  if (task.userIds) {
    try {
      userIds = JSON.parse(task.userIds) as number[]
      if (!Array.isArray(userIds)) userIds = []
    } catch {
      userIds = []
    }
  }

  const checkItems = parseCheckItemsJson(task.checkItems)
  const tagRows =
    checkItems.length > 0
      ? await prisma.nfcTag.findMany({
          where: { id: { in: checkItems.map((c) => c.nfcTagId) } },
          select: { id: true, tagId: true, location: true },
        })
      : []
  const tagById = new Map(tagRows.map((t) => [t.id, t]))

  const itemsOut = checkItems.map((c) => {
    const t = tagById.get(c.nfcTagId)
    return {
      name: c.name,
      nfcTagId: c.nfcTagId,
      tagId: c.tagId ?? t?.tagId ?? '',
      location: c.location ?? t?.location ?? '',
    }
  })

  const records = await prisma.inspectionRecord.findMany({
    where: { taskId, companyId: user.companyId },
    orderBy: { checkedAt: 'asc' },
  })
  const doneSet = new Set(records.map((r) => r.tagId))

  const progress = {
    total: itemsOut.length,
    done: itemsOut.filter((i) => i.tagId && doneSet.has(i.tagId)).length,
  }

  const canExecute = userIds.length === 0 || userIds.includes(user.id)

  return NextResponse.json({
    success: true,
    data: {
      id: task.id,
      code: task.code,
      planName: task.planName,
      inspectionType: task.inspectionType,
      scheduledDate: task.scheduledDate.toISOString(),
      status: normalizeInspectionTaskStatus(task.status),
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      userIds,
      canExecute,
      buildingId: task.buildingId,
      buildingName: task.building?.name ?? null,
      checkItems: itemsOut,
      progress,
      doneTagIds: [...doneSet],
      route: task.route,
      requirePhoto: task.requirePhoto,
    },
  })
}
