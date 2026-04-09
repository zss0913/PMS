import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  inspectionSeverityLabel,
  parseInspectionRecordDetail,
} from '@/lib/inspection-record-detail'
import { resolveLinkedWorkOrderForInspectionRecord } from '@/lib/inspection-record-linked-work-order'

/** 员工端：单条巡检记录详情（与 PC 字段一致，另附 parsed 便于移动端展示） */
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

  const parsed = parseInspectionRecordDetail(r.checkItems)
  let severityLabel: string | null = null
  if (parsed.kind === 'abnormal' && parsed.severity) {
    severityLabel = inspectionSeverityLabel(parsed.severity)
  }

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
      parsed,
      severityLabel,
      linkedWorkOrder,
    },
  })
}
