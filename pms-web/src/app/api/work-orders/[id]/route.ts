import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { parseWorkOrderImageUrls } from '@/lib/work-order'
import {
  WORK_ORDER_ACTION,
  buildWorkOrderEditChanges,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

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

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  images: z.union([imagesJson, z.null()]).optional(),
})

export async function GET(
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
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        tenant: { select: { id: true, companyName: true } },
        assignedEmployee: { select: { id: true, name: true } },
      },
    })

    if (!workOrder) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const completionImageUrls = parseWorkOrderImageUrls(workOrder.completionImages)

    let tenantPayload = workOrder.tenant
    if (!tenantPayload && workOrder.tenantId != null) {
      tenantPayload = await prisma.tenant.findFirst({
        where: { id: workOrder.tenantId, companyId: user.companyId },
        select: { id: true, companyName: true },
      })
    }

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true, phone: true },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        workOrder: {
          id: workOrder.id,
          code: workOrder.code,
          title: workOrder.title,
          type: workOrder.type,
          source: workOrder.source,
          description: workOrder.description,
          images: workOrder.images,
          location: workOrder.location,
          status: workOrder.status,
          facilityScope: workOrder.facilityScope,
          feeNoticeAcknowledged: workOrder.feeNoticeAcknowledged,
          feeRemark: workOrder.feeRemark,
          feeTotal: workOrder.feeTotal,
          feeConfirmedAt: workOrder.feeConfirmedAt?.toISOString() ?? null,
          building: workOrder.building,
          room: workOrder.room,
          tenant: tenantPayload,
          assignedTo: workOrder.assignedTo,
          assignedEmployee: workOrder.assignedEmployee,
          assignedAt: workOrder.assignedAt?.toISOString() ?? null,
          respondedAt: workOrder.respondedAt?.toISOString() ?? null,
          completedAt: workOrder.completedAt?.toISOString() ?? null,
          evaluatedAt: workOrder.evaluatedAt?.toISOString() ?? null,
          completionImageUrls,
          completionRemark: workOrder.completionRemark,
          evaluationNote: workOrder.evaluationNote,
          createdAt: workOrder.createdAt.toISOString(),
          updatedAt: workOrder.updatedAt.toISOString(),
        },
        employees,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function PUT(
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
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const existing = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

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
