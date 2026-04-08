import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'
import { fetchLinkedDevicesPerCheckItem } from '@/lib/inspection-task-linked-devices'
import { fetchInspectionPointImagesPerCheckItem } from '@/lib/inspection-task-point-images'
import {
  normalizeInspectionTaskStatus,
  syncInspectionTaskProgress,
} from '@/lib/inspection-task-status'

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

    let task = await prisma.inspectionTask.findFirst({
      where: { id: taskId, companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    })

    if (!task) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
    }

    await syncInspectionTaskProgress(prisma, taskId)
    task = await prisma.inspectionTask.findFirst({
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

    const [devicesPerItem, imagesPerItem] = await Promise.all([
      fetchLinkedDevicesPerCheckItem(prisma, {
        companyId: user.companyId,
        buildingId: task.buildingId,
        planId: task.planId,
        inspectionType: task.inspectionType,
        checkItems,
      }),
      fetchInspectionPointImagesPerCheckItem(prisma, {
        companyId: user.companyId,
        buildingId: task.buildingId,
        planId: task.planId,
        inspectionType: task.inspectionType,
        checkItems,
      }),
    ])

    const itemsOut = checkItems.map((c, i) => {
      const t = tagById.get(c.nfcTagId)
      return {
        name: c.name,
        nfcTagId: c.nfcTagId,
        tagId: c.tagId ?? t?.tagId ?? '',
        location: c.location ?? t?.location ?? '',
        linkedDevices: devicesPerItem[i] ?? [],
        pointImages: imagesPerItem[i] ?? [],
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
    userIds = [...new Set(userIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]

    const assignees =
      userIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: userIds }, companyId: user.companyId },
            select: { id: true, name: true, status: true },
          })
        : []
    const assignNameById = Object.fromEntries(assignees.map((e) => [e.id, e.name]))
    const personnelNames =
      userIds.map((id) => assignNameById[id]).filter(Boolean).join('、') || '-'
    const assignedStaff = assignees.map((e) => ({
      id: e.id,
      name: e.name,
      active: e.status === 'active',
    }))

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
        assignedStaff,
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

/** 更新巡检人员（userIds 为本公司员工 id 列表，可空） */
export async function PATCH(
  request: NextRequest,
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

    const body = (await request.json()) as { userIds?: unknown }
    if (!Array.isArray(body.userIds)) {
      return NextResponse.json({ success: false, message: 'userIds 须为数组' }, { status: 400 })
    }

    const ids = [
      ...new Set(
        body.userIds
          .map((x) => (typeof x === 'number' ? x : parseInt(String(x), 10)))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ]

    if (ids.length > 0) {
      const found = await prisma.employee.findMany({
        where: { id: { in: ids }, companyId: user.companyId },
        select: { id: true },
      })
      if (found.length !== ids.length) {
        return NextResponse.json(
          { success: false, message: '存在无效或非本公司员工' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.inspectionTask.updateMany({
      where: { id: taskId, companyId: user.companyId },
      data: {
        userIds: ids.length > 0 ? JSON.stringify(ids) : null,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: '已更新人员' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

/** 删除任务（关联巡检记录随库级级联删除） */
export async function DELETE(
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

    const del = await prisma.inspectionTask.deleteMany({
      where: { id: taskId, companyId: user.companyId },
    })

    if (del.count === 0) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: '已删除' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
