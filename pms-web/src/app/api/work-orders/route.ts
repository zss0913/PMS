import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { WORK_ORDER_STATUS_OPTIONS, WORK_ORDER_SOURCE_OPTIONS } from '@/lib/work-order'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

const workOrderSourceZodEnum = z.enum(
  WORK_ORDER_SOURCE_OPTIONS as unknown as [string, string, ...string[]]
)

const createSchema = z.object({
  buildingId: z.number({ required_error: '请选择楼宇' }),
  roomId: z.number().int().positive().optional().nullable(),
  tenantId: z.number().int().positive().optional().nullable(),
  source: workOrderSourceZodEnum.default('PC自建'),
  type: z.string().min(1, '工单类型必填'),
  title: z.string().min(1, '标题必填'),
  description: z.string().min(1, '描述不能为空'),
  images: z.string().optional(),
})

function genWorkOrderCode() {
  return 'WO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

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
    const status = searchParams.get('status')?.trim() || undefined
    const createdFrom = searchParams.get('createdFrom')?.trim() || undefined
    const createdTo = searchParams.get('createdTo')?.trim() || undefined
    const type = searchParams.get('type')?.trim() || undefined
    const source = searchParams.get('source')?.trim() || undefined
    const tenantQ = searchParams.get('tenantQ')?.trim() || undefined
    const assigneeQ = searchParams.get('assigneeQ')?.trim() || undefined

    const where: Prisma.WorkOrderWhereInput = { companyId: user.companyId }
    if (status && (WORK_ORDER_STATUS_OPTIONS as readonly string[]).includes(status)) {
      where.status = status
    }
    if (type) {
      where.type = type
    }
    if (source && (WORK_ORDER_SOURCE_OPTIONS as readonly string[]).includes(source)) {
      if (source === '租客自建') {
        where.source = { in: ['租客自建', '租客端'] }
      } else if (source === 'PC自建') {
        where.source = { in: ['PC自建', 'PC端'] }
      } else {
        where.source = source
      }
    }
    if (createdFrom || createdTo) {
      const createdAt: Prisma.DateTimeFilter = {}
      if (createdFrom) {
        const d = new Date(createdFrom + 'T00:00:00.000')
        if (!Number.isNaN(d.getTime())) createdAt.gte = d
      }
      if (createdTo) {
        const d = new Date(createdTo + 'T23:59:59.999')
        if (!Number.isNaN(d.getTime())) createdAt.lte = d
      }
      if (Object.keys(createdAt).length > 0) where.createdAt = createdAt
    }
    if (tenantQ) {
      where.tenant = { companyName: { contains: tenantQ } }
    }
    if (assigneeQ) {
      where.assignedEmployee = { name: { contains: assigneeQ } }
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        tenant: { select: { id: true, companyName: true } },
        assignedEmployee: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })
    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true, phone: true },
      orderBy: { id: 'asc' },
    })
    const workOrderTypes = await prisma.workOrderType.findMany({
      where: { companyId: user.companyId, enabled: true },
      select: { id: true, name: true },
      orderBy: { sort: 'asc' },
    })

    const list = workOrders.map((wo) => ({
      id: wo.id,
      code: wo.code,
      title: wo.title,
      type: wo.type,
      source: wo.source,
      facilityScope: wo.facilityScope,
      status: wo.status,
      building: wo.building,
      room: wo.room,
      tenant: wo.tenant,
      assignedTo: wo.assignedTo,
      assignedEmployee: wo.assignedEmployee,
      createdAt: wo.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        list,
        buildings,
        employees,
        workOrderTypes,
        sourceOptions: [...WORK_ORDER_SOURCE_OPTIONS],
        statusOptions: [...WORK_ORDER_STATUS_OPTIONS],
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const parsed = createSchema.parse(body)

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId: user.companyId },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 400 })
    }

    if (parsed.roomId != null) {
      const room = await prisma.room.findFirst({
        where: {
          id: parsed.roomId,
          buildingId: parsed.buildingId,
          companyId: user.companyId,
        },
      })
      if (!room) {
        return NextResponse.json({ success: false, message: '房源不存在或不属于该楼宇' }, { status: 400 })
      }
    }

    if (parsed.tenantId != null) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: parsed.tenantId, companyId: user.companyId },
      })
      if (!tenant) {
        return NextResponse.json({ success: false, message: '租客不存在' }, { status: 400 })
      }
      if (parsed.roomId != null) {
        const link = await prisma.tenantRoom.findFirst({
          where: { tenantId: parsed.tenantId, roomId: parsed.roomId },
        })
        if (!link) {
          return NextResponse.json(
            { success: false, message: '该租客未绑定所选房源' },
            { status: 400 }
          )
        }
      }
    }

    let code = genWorkOrderCode()
    while (await prisma.workOrder.findUnique({ where: { code } })) {
      code = genWorkOrderCode()
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        code,
        building: { connect: { id: parsed.buildingId } },
        ...(parsed.roomId != null ? { room: { connect: { id: parsed.roomId } } } : {}),
        ...(parsed.tenantId != null ? { tenant: { connect: { id: parsed.tenantId } } } : {}),
        reporterId: user.id,
        source: parsed.source,
        type: parsed.type,
        title: parsed.title,
        description: parsed.description,
        images: parsed.images?.trim() || null,
        status: '待派单',
        company: { connect: { id: user.companyId } },
      },
    })

    const op = operatorFromAuthUser(user)
    await logWorkOrderActivity(prisma, {
      workOrderId: workOrder.id,
      workOrderCode: workOrder.code,
      companyId: user.companyId,
      action: WORK_ORDER_ACTION.CREATE,
      summary: `创建工单「${workOrder.title}」，类型 ${workOrder.type}，来源 ${workOrder.source}`,
      ...op,
    })

    return NextResponse.json({ success: true, data: { id: workOrder.id, code: workOrder.code } })
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
