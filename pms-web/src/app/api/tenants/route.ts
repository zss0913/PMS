import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const createSchema = z.object({
  type: z.enum(['租客', '业主']),
  companyName: z.string().min(1, '公司名称必填'),
  buildingId: z.number({ required_error: '请选择所属楼宇' }),
  roomIds: z.array(z.object({ roomId: z.number(), leaseArea: z.number() })).min(1, '请至少选择一个租赁房源'),
  moveInDate: z.string().min(1, '入住日期必填'),
  leaseStartDate: z.string().min(1, '租期开始必填'),
  leaseEndDate: z.string().min(1, '租期结束必填'),
})

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
    const companyName = searchParams.get('companyName')?.trim() || undefined
    const type = searchParams.get('type')?.trim() || undefined
    const buildingId = searchParams.get('buildingId')
    const buildingIdNum = buildingId ? parseInt(buildingId, 10) : undefined

    const where: Record<string, unknown> = { companyId: user.companyId }
    if (companyName) {
      where.companyName = { contains: companyName }
    }
    if (type) {
      where.type = type
    }
    if (buildingIdNum && !isNaN(buildingIdNum)) {
      where.buildingId = buildingIdNum
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        tenantRooms: {
          include: { room: { select: { id: true, name: true, roomNumber: true } } },
        },
        _count: { select: { tenantUsers: true } },
      },
      orderBy: { id: 'desc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const list = tenants.map((t) => ({
      id: t.id,
      type: t.type,
      companyName: t.companyName,
      buildingId: t.buildingId,
      building: t.building,
      roomNumbers: t.tenantRooms.map((tr) => tr.room.roomNumber).join(', '),
      rooms: t.tenantRooms.map((tr) => ({
        roomId: tr.roomId,
        roomNumber: tr.room.roomNumber,
        name: tr.room.name,
        leaseArea: Number(tr.leaseArea),
      })),
      totalArea: Number(t.totalArea),
      moveInDate: t.moveInDate.toISOString().slice(0, 10),
      leaseStartDate: t.leaseStartDate.toISOString().slice(0, 10),
      leaseEndDate: t.leaseEndDate.toISOString().slice(0, 10),
      employeeCount: t._count.tenantUsers,
      createdAt: t.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { list, buildings },
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
    const companyName = parsed.companyName.trim()

    const nameDup = await prisma.tenant.findFirst({
      where: { companyId: user.companyId, companyName },
    })
    if (nameDup) {
      return NextResponse.json(
        { success: false, message: '该公司名称在当前物业公司下已存在，请勿重复' },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.create({
      data: {
        type: parsed.type,
        companyName,
        buildingId: parsed.buildingId,
        moveInDate: new Date(parsed.moveInDate),
        leaseStartDate: new Date(parsed.leaseStartDate),
        leaseEndDate: new Date(parsed.leaseEndDate),
        totalArea: new Decimal(totalArea),
        companyId: user.companyId,
      },
    })

    await prisma.tenantRoom.createMany({
      data: parsed.roomIds.map((r) => ({
        tenantId: tenant.id,
        roomId: r.roomId,
        leaseArea: new Decimal(r.leaseArea),
      })),
    })

    return NextResponse.json({ success: true, data: { id: tenant.id } })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { success: false, message: '该公司名称在当前物业公司下已存在，请勿重复' },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
