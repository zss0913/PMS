import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'
import { syncInspectionTaskProgress } from '@/lib/inspection-task-status'
import { logWorkOrderActivity, WORK_ORDER_ACTION } from '@/lib/work-order-activity-log'
import { writeStaffNotifications } from '@/lib/staff-notification-write'
import { businessTagForInspectionType } from '@/lib/staff-notification-routing'

const bodySchema = z.object({
  tagId: z.string().min(1, '请提供标签编号'),
  pointName: z.string().min(1, '请提供检查点名称'),
  severity: z.enum(['low', 'medium', 'high']),
  description: z.string().min(1, '请填写异常描述'),
  images: z.array(z.string()).max(12).optional(),
})

function normalizeTagId(s: string) {
  return String(s || '').trim().toUpperCase().replace(/\s/g, '')
}

function severityLabel(v: 'low' | 'medium' | 'high') {
  if (v === 'low') return '轻微'
  if (v === 'high') return '紧急'
  return '一般'
}

function genWorkOrderCode() {
  return 'WO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(request)
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

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误' },
        { status: 400 }
      )
    }
    return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
  }

  const task = await prisma.inspectionTask.findFirst({
    where: { id: taskId, companyId: user.companyId },
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
  if (userIds.length > 0 && !userIds.includes(user.id)) {
    return NextResponse.json({ success: false, message: '您不在该任务的巡检人员列表中' }, { status: 403 })
  }

  const normTagId = normalizeTagId(body.tagId)
  const items = parseCheckItemsJson(task.checkItems)
  const tagRows = await prisma.nfcTag.findMany({
    where: { id: { in: items.map((i) => i.nfcTagId) }, companyId: user.companyId },
  })
  const matched = tagRows.find((row) => normalizeTagId(row.tagId) === normTagId)
  if (!matched) {
    return NextResponse.json(
      { success: false, message: '标签编号与当前任务路线中的 NFC 不匹配' },
      { status: 400 }
    )
  }

  const routeItem = items.find((it) => it.nfcTagId === matched.id)
  if (!routeItem) {
    return NextResponse.json(
      { success: false, message: '该标签不属于本巡检任务的检查项' },
      { status: 400 }
    )
  }

  const dup = await prisma.inspectionRecord.findFirst({
    where: { taskId, companyId: user.companyId, tagId: matched.tagId, status: 'abnormal' },
  })
  if (dup) {
    return NextResponse.json({ success: false, message: '该检查点已上报过异常' }, { status: 400 })
  }

  const recordPayloadBase = {
    pointName: body.pointName.trim(),
    severity: body.severity,
    description: body.description.trim(),
    images: body.images?.filter(Boolean) ?? [],
    submitWorkOrder: true as const,
  }

  let code = genWorkOrderCode()
  while (await prisma.workOrder.findUnique({ where: { code } })) {
    code = genWorkOrderCode()
  }

  const created = await prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.create({
      data: {
        code,
        buildingId: task.buildingId ?? matched.buildingId,
        reporterId: user.id,
        source: '巡检发现',
        type: '巡检发现',
        title: `${body.pointName.trim()}异常`,
        description: body.description.trim(),
        images: recordPayloadBase.images.length
          ? JSON.stringify(recordPayloadBase.images)
          : null,
        location: matched.location,
        severity: severityLabel(body.severity),
        taskId: task.id,
        tagId: matched.tagId,
        status: '待派单',
        companyId: user.companyId,
      },
    })

    const checkItemsStored = {
      ...recordPayloadBase,
      workOrderId: workOrder.id,
      workOrderCode: workOrder.code,
    }

    const inspectionRecord = await tx.inspectionRecord.create({
      data: {
        taskId,
        taskCode: task.code,
        inspectionType: task.inspectionType,
        tagId: matched.tagId,
        location: matched.location,
        checkedAt: new Date(),
        checkedBy: user.id,
        status: 'abnormal',
        checkItems: JSON.stringify(checkItemsStored),
        companyId: user.companyId,
      },
    })

    await logWorkOrderActivity(tx, {
      workOrderId: workOrder.id,
      workOrderCode: workOrder.code,
      companyId: user.companyId,
      action: WORK_ORDER_ACTION.CREATE,
      summary: `巡检发现生成工单「${workOrder.title}」`,
      meta: {
        inspectionTaskId: task.id,
        inspectionRecordId: inspectionRecord.id,
        tagId: matched.tagId,
        severity: severityLabel(body.severity),
      },
      operatorId: user.id,
      operatorName: user.name ?? null,
      operatorPhone: user.phone ?? null,
    })

    return { inspectionRecord, workOrder }
  })

  await syncInspectionTaskProgress(prisma, taskId)

  await writeStaffNotifications(prisma, {
    companyId: user.companyId,
    buildingId: task.buildingId ?? matched.buildingId,
    businessTag: businessTagForInspectionType(task.inspectionType),
    category: 'work_order',
    entityId: created.workOrder.id,
        title: `巡检发现工单：${created.workOrder.title}`,
    summary: `${created.workOrder.code} · ${created.workOrder.status} · ${severityLabel(body.severity)}`,
  })

  return NextResponse.json({
    success: true,
    data: {
      inspectionRecordId: created.inspectionRecord.id,
      workOrderId: created.workOrder.id,
      workOrderCode: created.workOrder.code,
    },
  })
}
