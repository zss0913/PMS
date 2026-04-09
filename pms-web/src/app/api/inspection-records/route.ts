import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { batchResolveLinkedWorkOrdersForInspectionRecords } from '@/lib/inspection-record-linked-work-order'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const taskIdStr = searchParams.get('taskId')?.trim()
    const taskCodeSearch = searchParams.get('taskCode')?.trim()
    const buildingIdStr = searchParams.get('buildingId')?.trim()
    const inspectionType = searchParams.get('inspectionType')?.trim()
    const tagId = searchParams.get('tagId')?.trim()
    const dateFrom = searchParams.get('dateFrom')?.trim()
    const dateTo = searchParams.get('dateTo')?.trim()
    const resultStatus = searchParams.get('resultStatus')?.trim()

    const andParts: Prisma.InspectionRecordWhereInput[] = [{ companyId: user.companyId }]

    if (taskIdStr) {
      const tid = parseInt(taskIdStr, 10)
      if (!Number.isNaN(tid)) andParts.push({ taskId: tid })
    }
    if (taskCodeSearch) {
      andParts.push({
        OR: [
          { taskCode: { contains: taskCodeSearch } },
          {
            task: {
              planName: { contains: taskCodeSearch },
              companyId: user.companyId,
            },
          },
        ],
      })
    }
    if (inspectionType) andParts.push({ inspectionType })
    if (tagId) andParts.push({ tagId: { contains: tagId } })
    if (resultStatus === 'normal' || resultStatus === 'abnormal') {
      andParts.push({ status: resultStatus })
    }
    if (dateFrom || dateTo) {
      const gte = dateFrom ? new Date(dateFrom + 'T00:00:00') : undefined
      const lte = dateTo ? new Date(dateTo + 'T23:59:59.999') : undefined
      const checkedAt: Prisma.DateTimeFilter = {}
      if (gte && !Number.isNaN(gte.getTime())) checkedAt.gte = gte
      if (lte && !Number.isNaN(lte.getTime())) checkedAt.lte = lte
      andParts.push({ checkedAt })
    }
    if (buildingIdStr) {
      const bid = parseInt(buildingIdStr, 10)
      if (!Number.isNaN(bid)) {
        andParts.push({
          task: { buildingId: bid, companyId: user.companyId },
        })
      }
    }

    const where: Prisma.InspectionRecordWhereInput =
      andParts.length === 1 ? andParts[0]! : { AND: andParts }

    const records = await prisma.inspectionRecord.findMany({
      where,
      orderBy: { checkedAt: 'desc' },
      take: 2000,
    })
    const checkedByIds = [...new Set(records.map((r) => r.checkedBy).filter(Boolean))]
    const employees =
      checkedByIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: checkedByIds } },
            select: { id: true, name: true },
          })
        : []
    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e.name]))

    const taskIds = [...new Set(records.map((r) => r.taskId))]
    const tasks =
      taskIds.length > 0
        ? await prisma.inspectionTask.findMany({
            where: { id: { in: taskIds }, companyId: user.companyId },
            select: { id: true, buildingId: true, planName: true },
          })
        : []
    const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]))

    const linkedMap = await batchResolveLinkedWorkOrdersForInspectionRecords(prisma, user.companyId, records)

    const list = records.map((r) => {
      const tk = taskMap[r.taskId]
      const linkedWorkOrder = linkedMap.get(r.id) ?? null
      return {
        id: r.id,
        taskId: r.taskId,
        taskCode: r.taskCode,
        planName: tk?.planName ?? null,
        buildingId: tk?.buildingId ?? null,
        inspectionType: r.inspectionType,
        tagId: r.tagId,
        location: r.location,
        checkedAt: r.checkedAt.toISOString(),
        checkedBy: r.checkedBy,
        checkedByName: employeeMap[r.checkedBy] ?? '-',
        status: r.status,
        detail: r.checkItems,
        linkedWorkOrder,
      }
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: { list, buildings, inspectionTypes: ['工程', '安保', '设备', '绿化'] },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
