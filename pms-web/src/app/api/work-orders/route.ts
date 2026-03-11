import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const STATUS_OPTIONS = ['待派单', '待响应', '处理中', '待评价', '评价完成', '已取消']

const createSchema = z.object({
  buildingId: z.number({ required_error: '请选择楼宇' }),
  roomId: z.number({ required_error: '请选择房源' }),
  tenantId: z.number({ required_error: '请选择租客' }),
  source: z.string().min(1, '来源必填'),
  type: z.string().min(1, '工单类型必填'),
  title: z.string().min(1, '标题必填'),
  description: z.string().optional().default(''),
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

    const where: Record<string, unknown> = { companyId: user.companyId }
    if (status && STATUS_OPTIONS.includes(status)) {
      where.status = status
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
      select: { id: true, name: true },
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
      building: wo.building,
      room: wo.room,
      tenant: wo.tenant,
      status: wo.status,
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
        statusOptions: STATUS_OPTIONS,
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

    const room = await prisma.room.findFirst({
      where: { id: parsed.roomId, buildingId: parsed.buildingId, companyId: user.companyId },
    })
    if (!room) {
      return NextResponse.json({ success: false, message: '房源不存在' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.tenantId, companyId: user.companyId },
    })
    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 400 })
    }

    let code = genWorkOrderCode()
    while (await prisma.workOrder.findUnique({ where: { code } })) {
      code = genWorkOrderCode()
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        code,
        buildingId: parsed.buildingId,
        roomId: parsed.roomId,
        tenantId: parsed.tenantId,
        reporterId: user.id,
        source: parsed.source,
        type: parsed.type,
        title: parsed.title,
        description: parsed.description || '',
        status: '待派单',
        companyId: user.companyId,
      },
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
