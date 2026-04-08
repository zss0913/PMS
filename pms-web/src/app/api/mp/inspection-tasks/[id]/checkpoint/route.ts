import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'
import { syncInspectionTaskProgress } from '@/lib/inspection-task-status'
import { logWorkOrderActivity, WORK_ORDER_ACTION } from '@/lib/work-order-activity-log'
import { writeStaffNotifications } from '@/lib/staff-notification-write'
import { businessTagForInspectionType } from '@/lib/staff-notification-routing'

const bodySchema = z.object({
  scannedTagId: z.string().min(1, '请提供读卡或手输的标签编号'),
  remark: z.string().optional(),
  images: z.array(z.string()).max(12).optional(),
  /** 未传时视为 normal，兼容旧版客户端 */
  resultStatus: z.enum(['normal', 'abnormal']).optional().default('normal'),
  /** 异常时必填 */
  abnormalDescription: z.string().optional(),
  /** 异常时是否同时生成工单 */
  submitWorkOrder: z.boolean().optional(),
  workOrderSeverity: z.enum(['low', 'medium', 'high']).optional(),
})

function severityLabel(v: 'low' | 'medium' | 'high') {
  if (v === 'low') return '轻微'
  if (v === 'high') return '紧急'
  return '一般'
}

function genWorkOrderCode() {
  return 'WO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

/** 员工端：提交单个 NFC 巡检点（读卡编号须与任务内检查项一致） */
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

  const task = await prisma.inspectionTask.findFirst({
    where: { id: taskId, companyId: user.companyId },
    include: {
      plan: { select: { requirePhoto: true } },
    },
  })
  if (!task) {
    return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
  }

  const requirePhotoEffective =
    task.plan != null ? task.plan.requirePhoto : task.requirePhoto

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

  const norm = (s: string) => s.trim().toUpperCase().replace(/\s/g, '')
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

  const scanned = norm(body.scannedTagId)
  const items = parseCheckItemsJson(task.checkItems)
  const tagRows = await prisma.nfcTag.findMany({
    where: { id: { in: items.map((i) => i.nfcTagId) }, companyId: user.companyId },
  })
  const byBusiness = new Map(tagRows.map((t) => [norm(t.tagId), t]))
  const matched = byBusiness.get(scanned)
  if (!matched) {
    return NextResponse.json(
      { success: false, message: '读卡编号与当前任务路线中的 NFC 不匹配' },
      { status: 400 }
    )
  }

  const inRoute = items.some((i) => i.nfcTagId === matched.id)
  if (!inRoute) {
    return NextResponse.json(
      { success: false, message: '该标签不属于本巡检任务的检查项' },
      { status: 400 }
    )
  }

  const dup = await prisma.inspectionRecord.findFirst({
    where: { taskId, companyId: user.companyId, tagId: matched.tagId },
  })
  if (dup) {
    return NextResponse.json({ success: false, message: '该巡检点已提交过' }, { status: 400 })
  }

  const imgs = body.images?.filter(Boolean) ?? []
  if (requirePhotoEffective && imgs.length === 0) {
    return NextResponse.json(
      { success: false, message: '本任务要求拍照，请先拍摄并上传现场照片' },
      { status: 400 }
    )
  }

  const routeItem = items.find((it) => it.nfcTagId === matched.id)
  const pointName = routeItem?.name?.trim() || '巡检点'

  if (body.resultStatus === 'normal') {
    const payload = {
      remark: body.remark?.trim() || undefined,
      images: imgs,
    }
    await prisma.inspectionRecord.create({
      data: {
        taskId,
        taskCode: task.code,
        inspectionType: task.inspectionType,
        tagId: matched.tagId,
        location: matched.location,
        checkedAt: new Date(),
        checkedBy: user.id,
        status: 'normal',
        checkItems: JSON.stringify(payload),
        companyId: user.companyId,
      },
    })
  } else {
    const desc = body.abnormalDescription?.trim()
    if (!desc) {
      return NextResponse.json({ success: false, message: '请填写异常说明' }, { status: 400 })
    }

    if (body.submitWorkOrder) {
      const sev = body.workOrderSeverity
      if (!sev) {
        return NextResponse.json(
          { success: false, message: '生成工单时请选择题急迫程度' },
          { status: 400 }
        )
      }

      const recordPayloadBase = {
        pointName,
        severity: sev,
        description: desc,
        images: imgs,
        remark: body.remark?.trim() || undefined,
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
            title: `${pointName}异常`,
            description: desc,
            images: recordPayloadBase.images.length
              ? JSON.stringify(recordPayloadBase.images)
              : null,
            location: matched.location,
            severity: severityLabel(sev),
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
            severity: severityLabel(sev),
          },
          operatorId: user.id,
          operatorName: user.name ?? null,
          operatorPhone: user.phone ?? null,
        })

        return { workOrder }
      })

      await writeStaffNotifications(prisma, {
        companyId: user.companyId,
        buildingId: task.buildingId ?? matched.buildingId,
        businessTag: businessTagForInspectionType(task.inspectionType),
        category: 'work_order',
        entityId: created.workOrder.id,
        title: `巡检发现工单：${created.workOrder.title}`,
        summary: `${created.workOrder.code} · ${created.workOrder.status} · ${severityLabel(sev)}`,
      })
    } else {
      const payload = {
        pointName,
        description: desc,
        images: imgs,
        remark: body.remark?.trim() || undefined,
        submitWorkOrder: false,
      }
      await prisma.inspectionRecord.create({
        data: {
          taskId,
          taskCode: task.code,
          inspectionType: task.inspectionType,
          tagId: matched.tagId,
          location: matched.location,
          checkedAt: new Date(),
          checkedBy: user.id,
          status: 'abnormal',
          checkItems: JSON.stringify(payload),
          companyId: user.companyId,
        },
      })
    }
  }

  await syncInspectionTaskProgress(prisma, taskId)

  const updated = await prisma.inspectionTask.findUnique({ where: { id: taskId } })
  const recordsAfter = await prisma.inspectionRecord.findMany({
    where: { taskId },
    select: { tagId: true },
  })
  const doneSet = new Set(recordsAfter.map((r) => r.tagId))
  let done = 0
  for (const it of items) {
    const t = tagRows.find((x) => x.id === it.nfcTagId)
    if (t && doneSet.has(t.tagId)) done += 1
  }

  return NextResponse.json({
    success: true,
    data: {
      tagId: matched.tagId,
      status: updated?.status,
      progress: { total: items.length, done },
    },
  })
}
