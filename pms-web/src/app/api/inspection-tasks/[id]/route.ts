import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'
import { normalizeInspectionTaskStatus } from '@/lib/inspection-task-status'

/** PC：巡检任务详情（含检查项、楼宇、已打点记录摘要） */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
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
        plan: { select: { id: true, name: true } },
      },
    })

    if (!task) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
    }

    const checkItems = parseCheckItemsJson(task.checkItems)
    const tagRows =
      checkItems.length > 0
        ? await prisma.nfcTag.findMany({
            where: { id: { in: checkItems.map((c) => c.nfcTagId) } },
            select: { id: true, tagId: true, location: true, buildingId: true },
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
      orderBy: { checkedAt: 'desc' },
    })

    const checkedByIds = [...new Set(records.map((r) => r.checkedBy))]
    const emps =
      checkedByIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: checkedByIds } },
            select: { id: true, name: true },
          })
        : []
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e.name]))

    let userIds: number[] = []
    if (task.userIds) {
      try {
        userIds = JSON.parse(task.userIds) as number[]
        if (!Array.isArray(userIds)) userIds = []
      } catch {
        userIds = []
      }
    }

    const assignees =
      userIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: userIds }, companyId: user.companyId },
            select: { id: true, name: true },
          })
        : []
    const assignNameById = Object.fromEntries(assignees.map((e) => [e.id, e.name]))
    const personnelNames =
      userIds.map((id) => assignNameById[id]).filter(Boolean).join('、') || '-'

    const doneSet = new Set(records.map((r) => r.tagId))
    const progress = {
      total: itemsOut.length,
      done: itemsOut.filter((i) => i.tagId && doneSet.has(i.tagId)).length,
    }

    return NextResponse.json({
      success: true,
      data: {
        id: task.id,
        code: task.code,
        planName: task.plan?.name ?? task.planName,
        planId: task.planId,
        inspectionType: task.inspectionType,
        scheduledDate: task.scheduledDate.toISOString(),
        status: normalizeInspectionTaskStatus(task.status),
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        userIds,
        personnelNames,
        buildingId: task.buildingId,
        buildingName: task.building?.name ?? null,
        checkItems: itemsOut,
        progress,
        records: records.map((r) => ({
          id: r.id,
          tagId: r.tagId,
          location: r.location,
          checkedAt: r.checkedAt.toISOString(),
          checkedBy: r.checkedBy,
          checkedByName: empMap[r.checkedBy] ?? '-',
          status: r.status,
          detail: r.checkItems,
        })),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
