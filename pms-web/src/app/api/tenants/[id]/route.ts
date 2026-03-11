import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const updateSchema = z.object({
  type: z.enum(['租客', '业主']),
  companyName: z.string().min(1, '公司名称必填'),
  buildingId: z.number({ required_error: '请选择所属楼宇' }),
  roomIds: z.array(z.object({ roomId: z.number(), leaseArea: z.number() })).min(1, '请至少选择一个租赁房源'),
  moveInDate: z.string().min(1, '入住日期必填'),
  leaseStartDate: z.string().min(1, '租期开始必填'),
  leaseEndDate: z.string().min(1, '租期结束必填'),
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
    const tenantId = parseInt(id, 10)
    if (isNaN(tenantId)) {
      return NextResponse.json({ success: false, message: '无效的租客ID' }, { status: 400 })
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
        tenantRooms: {
          include: { room: { select: { id: true, name: true, roomNumber: true, area: true } } },
        },
        _count: { select: { tenantUsers: true } },
      },
    })

    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 404 })
    }

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const rooms = await prisma.room.findMany({
      where: { buildingId: tenant.buildingId, companyId: user.companyId },
      select: { id: true, name: true, roomNumber: true, area: true },
      orderBy: { roomNumber: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          type: tenant.type,
          companyName: tenant.companyName,
          buildingId: tenant.buildingId,
          building: tenant.building,
          totalArea: Number(tenant.totalArea),
          moveInDate: tenant.moveInDate.toISOString().slice(0, 10),
          leaseStartDate: tenant.leaseStartDate.toISOString().slice(0, 10),
          leaseEndDate: tenant.leaseEndDate.toISOString().slice(0, 10),
          employeeCount: tenant._count.tenantUsers,
          createdAt: tenant.createdAt.toISOString(),
          tenantRooms: tenant.tenantRooms.map((tr) => ({
            roomId: tr.roomId,
            roomNumber: tr.room.roomNumber,
            name: tr.room.name,
            leaseArea: Number(tr.leaseArea),
            area: Number(tr.room.area),
          })),
        },
        buildings,
        rooms,
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
    const tenantId = parseInt(id, 10)
    if (isNaN(tenantId)) {
      return NextResponse.json({ success: false, message: '无效的租客ID' }, { status: 400 })
    }

    const existing = await prisma.tenant.findFirst({
      where: { id: tenantId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId: user.companyId },
      include: { rooms: true },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '所属楼宇不存在' }, { status: 400 })
    }

    const roomIds = parsed.roomIds.map((r) => r.roomId)
    const invalidRooms = roomIds.filter(
      (rid) => !building.rooms.some((r) => r.id === rid)
    )
    if (invalidRooms.length > 0) {
      return NextResponse.json(
        { success: false, message: '租赁房源必须在所选楼宇下' },
        { status: 400 }
      )
    }

    const totalArea = parsed.roomIds.reduce((sum, r) => sum + r.leaseArea, 0)

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          type: parsed.type,
          companyName: parsed.companyName.trim(),
          buildingId: parsed.buildingId,
          moveInDate: new Date(parsed.moveInDate),
          leaseStartDate: new Date(parsed.leaseStartDate),
          leaseEndDate: new Date(parsed.leaseEndDate),
          totalArea: new Decimal(totalArea),
        },
      }),
      prisma.tenantRoom.deleteMany({ where: { tenantId } }),
      prisma.tenantRoom.createMany({
        data: parsed.roomIds.map((r) => ({
          tenantId,
          roomId: r.roomId,
          leaseArea: new Decimal(r.leaseArea),
        })),
      }),
    ])

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
    const tenantId = parseInt(id, 10)
    if (isNaN(tenantId)) {
      return NextResponse.json({ success: false, message: '无效的租客ID' }, { status: 400 })
    }

    const existing = await prisma.tenant.findFirst({
      where: { id: tenantId, companyId: user.companyId },
      include: {
        _count: { select: { bills: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '租客不存在' }, { status: 404 })
    }

    if (existing._count.bills > 0) {
      return NextResponse.json(
        { success: false, message: '该租客存在关联账单，无法删除' },
        { status: 400 }
      )
    }

    await prisma.tenant.delete({ where: { id: tenantId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
