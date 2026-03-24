import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseWorkOrderImageUrls } from '@/lib/work-order'
import { mpEmployeeWorkOrderVisibilityWhere } from '@/lib/mp-employee-work-order-scope'
import { fetchWorkOrderActivityLogs } from '@/lib/work-order-activity-log-db'
import {
  WORK_ORDER_ACTION,
  buildWorkOrderEditChanges,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'
import { resolveWorkOrderReporter } from '@/lib/work-order-reporter'
import { findPendingFeeCheckoutPayment } from '@/lib/mp-work-order-fee-pay'

const imagesJson = z
  .string()
  .refine((s) => {
    try {
      const a = JSON.parse(s) as unknown
      return Array.isArray(a) && a.every((x) => typeof x === 'string')
    } catch {
      return false
    }
  }, 'images 须为 URL 字符串的 JSON 数组')

const mpWorkOrderUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  images: z.union([imagesJson, z.null()]).optional(),
})

/** 租客端 / 员工端：工单详情（权限与列表一致） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, message: '未登录' },
        { status: 401 }
      )
    }

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    let where: Prisma.WorkOrderWhereInput

    if (user.type === 'tenant') {
      const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
      if (tenantIds.length === 0) {
        return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
      }
      where = {
        id: workOrderId,
        companyId: user.companyId,
        OR: [{ tenantId: { in: tenantIds } }, { reporterId: user.id }],
      }
    } else {
      const vis = mpEmployeeWorkOrderVisibilityWhere(user)
      where = {
        AND: [{ id: workOrderId }, vis],
      }
    }

    const wo = await prisma.workOrder.findFirst({
      where,
      include: {
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        tenant: { select: { id: true, companyName: true } },
        assignedEmployee: { select: { id: true, name: true, phone: true } },
      },
    })

    if (!wo) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const imageUrls = parseWorkOrderImageUrls(wo.images)
    const completionImageUrls = parseWorkOrderImageUrls(wo.completionImages)

    const reporter = await resolveWorkOrderReporter(
      prisma,
      wo.companyId,
      wo.reporterId,
      wo.source
    )

    const iso = (d: Date | null) => (d ? d.toISOString() : null)

    const activityLogRows = await fetchWorkOrderActivityLogs(
      prisma,
      user.companyId,
      workOrderId
    )
    const activityLogs = activityLogRows.map((l) => ({
      id: l.id,
      action: l.action,
      summary: l.summary,
      changesJson: l.changesJson,
      operatorName: l.operatorName,
      operatorPhone: l.operatorPhone,
      createdAt: l.createdAt.toISOString(),
    }))

    let employees:
      | { id: number; name: string; phone: string }[]
      | undefined
    if (user.type === 'employee' && user.companyId > 0) {
      employees = await prisma.employee.findMany({
        where: { companyId: user.companyId, status: 'active' },
        select: { id: true, name: true, phone: true },
        orderBy: { id: 'asc' },
      })
    }

    let tenantPayload =
      wo.tenant != null
        ? { id: wo.tenant.id, companyName: wo.tenant.companyName }
        : null
    if (!tenantPayload && wo.tenantId != null) {
      const t = await prisma.tenant.findFirst({
        where: { id: wo.tenantId, companyId: wo.companyId },
        select: { id: true, companyName: true },
      })
      if (t) tenantPayload = t
    }

    let feePayment:
      | {
          billId: number
          billCode: string
          feeType: string
          period: string
          dueDate: string
          accountReceivable: number
          amountDue: number
          paymentStatus: string
          pendingPayment: {
            id: number
            code: string
            paymentMethod: string
            paymentStatus: string
          } | null
        }
      | undefined

    if (user.type === 'tenant' && wo.status === '待租客确认费用') {
      const feeBill = await prisma.bill.findFirst({
        where: {
          companyId: wo.companyId,
          workOrderId: wo.id,
          billSource: 'work_order_fee',
        },
        orderBy: { id: 'desc' },
      })
      if (feeBill) {
        const pending = await findPendingFeeCheckoutPayment(prisma, feeBill.id, wo.companyId)
        feePayment = {
          billId: feeBill.id,
          billCode: feeBill.code,
          feeType: feeBill.feeType,
          period: feeBill.period,
          dueDate: feeBill.dueDate.toISOString(),
          accountReceivable: Number(feeBill.accountReceivable),
          amountDue: Number(feeBill.amountDue),
          paymentStatus: feeBill.paymentStatus,
          pendingPayment: pending
            ? {
                id: pending.id,
                code: pending.code,
                paymentMethod: pending.paymentMethod,
                paymentStatus: pending.paymentStatus,
              }
            : null,
        }
      }
    }

    return NextResponse.json({
      success: true,
      activityLogs,
      ...(employees ? { employees } : {}),
      ...(feePayment ? { feePayment } : {}),
      workOrder: {
        id: wo.id,
        code: wo.code,
        title: wo.title,
        type: wo.type,
        description: wo.description,
        status: wo.status,
        source: wo.source,
        facilityScope: wo.facilityScope,
        feeRemark: wo.feeRemark,
        feeTotal: wo.feeTotal,
        feeNoticeAcknowledged: wo.feeNoticeAcknowledged,
        location: wo.location,
        severity: wo.severity,
        projectId: wo.projectId,
        taskId: wo.taskId,
        tagId: wo.tagId,
        images: wo.images,
        imageUrls,
        completionImageUrls,
        completionRemark: wo.completionRemark,
        evaluationNote: wo.evaluationNote,
        building: wo.building,
        room: wo.room,
        tenant: tenantPayload,
        reporterId: wo.reporterId,
        reporter,
        assignedTo: wo.assignedTo,
        assignedEmployee: wo.assignedEmployee,
        assignedAt: iso(wo.assignedAt),
        respondedAt: iso(wo.respondedAt),
        feeConfirmedAt: iso(wo.feeConfirmedAt),
        completedAt: iso(wo.completedAt),
        evaluatedAt: iso(wo.evaluatedAt),
        createdAt: wo.createdAt.toISOString(),
        updatedAt: wo.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

/** 租客端 / 员工端：编辑标题、描述、图片（与 PC PUT 规则一致，权限与详情 GET 一致） */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    let existingWhere: Prisma.WorkOrderWhereInput
    if (user.type === 'tenant') {
      const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
      if (tenantIds.length === 0) {
        return NextResponse.json({ success: false, message: '无租客关联' }, { status: 400 })
      }
      existingWhere = {
        id: workOrderId,
        companyId: user.companyId,
        OR: [{ tenantId: { in: tenantIds } }, { reporterId: user.id }],
      }
    } else if (user.type === 'employee') {
      if (user.companyId === 0) {
        return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
      }
      const vis = mpEmployeeWorkOrderVisibilityWhere(user)
      existingWhere = { AND: [{ id: workOrderId }, vis] }
    } else {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    const existing = await prisma.workOrder.findFirst({
      where: existingWhere,
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    if (['评价完成', '已取消'].includes(existing.status)) {
      return NextResponse.json(
        { success: false, message: '当前状态不可编辑' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = mpWorkOrderUpdateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (parsed.title !== undefined) updateData.title = parsed.title
    if (parsed.description !== undefined) updateData.description = parsed.description
    if (parsed.images !== undefined) {
      if (parsed.images === null) {
        updateData.images = null
      } else {
        const arr = JSON.parse(parsed.images) as string[]
        updateData.images = arr.length > 0 ? parsed.images : null
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true })
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: updateData,
    })

    const newRow = {
      title: updateData.title !== undefined ? updateData.title : existing.title,
      description:
        updateData.description !== undefined ? updateData.description : existing.description,
      images: updateData.images !== undefined ? updateData.images : existing.images,
    }
    const oldRow = {
      title: existing.title,
      description: existing.description,
      images: existing.images,
    }
    const changes = buildWorkOrderEditChanges(oldRow, newRow, {
      title: '标题',
      description: '描述',
      images: '图片附件',
    })
    if (changes.length > 0) {
      await logWorkOrderActivity(prisma, {
        workOrderId,
        workOrderCode: existing.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.UPDATE,
        changes,
        ...operatorFromAuthUser(user),
      })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
