import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { resolveLinkedWorkOrderForInspectionRecord } from '@/lib/inspection-record-linked-work-order'

/** PC：单条巡检记录详情（含任务楼宇、计划名等上下文） */
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
    const recordId = parseInt(id, 10)
    if (Number.isNaN(recordId)) {
      return NextResponse.json({ success: false, message: '无效的记录ID' }, { status: 400 })
    }

    const r = await prisma.inspectionRecord.findFirst({
      where: { id: recordId, companyId: user.companyId },
      include: {
        task: {
          select: {
            id: true,
            buildingId: true,
            planName: true,
            building: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!r) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    const emp = await prisma.employee.findFirst({
      where: { id: r.checkedBy, companyId: user.companyId },
      select: { id: true, name: true },
    })

    const linkedWorkOrder = await resolveLinkedWorkOrderForInspectionRecord(prisma, {
      companyId: user.companyId,
      taskId: r.taskId,
      tagId: r.tagId,
      checkItemsJson: r.checkItems,
      recordStatus: r.status,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: r.id,
        taskId: r.taskId,
        taskCode: r.taskCode,
        planName: r.task?.planName ?? null,
        buildingId: r.task?.buildingId ?? null,
        buildingName: r.task?.building?.name ?? null,
        inspectionType: r.inspectionType,
        tagId: r.tagId,
        location: r.location,
        checkedAt: r.checkedAt.toISOString(),
        checkedBy: r.checkedBy,
        checkedByName: emp?.name ?? '-',
        status: r.status,
        detail: r.checkItems,
        linkedWorkOrder,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
