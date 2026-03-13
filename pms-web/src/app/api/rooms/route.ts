import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

// 自动计算楼层面积（根据该楼层所有房源的面积总和）
async function recalculateFloorArea(floorId: number) {
  try {
    const rooms = await prisma.room.findMany({
      where: { floorId },
      select: { area: true },
    })
    const totalArea = rooms.reduce((sum, room) => sum + Number(room.area), 0)
    await prisma.floor.update({
      where: { id: floorId },
      data: { area: totalArea },
    })
  } catch (e) {
    console.error('计算楼层面积失败:', e)
  }
}

const createSchema = z.object({
  name: z.string().min(1, '请输入房源名称'),
  roomNumber: z.string().min(1, '请输入房号'),
  area: z.number().min(0, '管理面积不能为负'),
  buildingId: z.number(),
  floorId: z.number(),
  type: z.enum(['商铺', '写字楼', '住宅']),
  status: z.enum(['空置', '已租', '自用']),
  leasingStatus: z.enum(['可招商', '不可招商']),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const companyId = user.companyId
    const baseWhere = companyId > 0 ? { companyId } : {}
    const name = request.nextUrl.searchParams.get('name')
    const roomNumber = request.nextUrl.searchParams.get('roomNumber')
    const buildingId = request.nextUrl.searchParams.get('buildingId')
    const status = request.nextUrl.searchParams.get('status')
    const leasingStatus = request.nextUrl.searchParams.get('leasingStatus')

    const where: Record<string, unknown> = { ...baseWhere }
    if (name?.trim()) where.name = { contains: name.trim() }
    if (roomNumber?.trim()) where.roomNumber = { contains: roomNumber.trim() }
    if (buildingId) {
      const bid = parseInt(buildingId, 10)
      if (!isNaN(bid)) where.buildingId = bid
    }
    if (status?.trim()) where.status = status.trim()
    if (leasingStatus?.trim()) where.leasingStatus = leasingStatus.trim()

    const rooms = await prisma.room.findMany({
      where,
      include: {
        building: { select: { name: true } },
        floor: { select: { name: true } },
        _count: { select: { tenantRooms: true } },
      },
      orderBy: { id: 'asc' },
    })
    return NextResponse.json({ success: true, data: rooms })
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
    const companyId = user.companyId
    if (companyId <= 0) {
      return NextResponse.json({ success: false, message: '超级管理员需指定公司' }, { status: 400 })
    }
    const body = await request.json()
    const parsed = createSchema.parse(body)
    const room = await prisma.room.create({
      data: {
        name: parsed.name,
        roomNumber: parsed.roomNumber,
        area: parsed.area,
        buildingId: parsed.buildingId,
        floorId: parsed.floorId,
        type: parsed.type,
        status: parsed.status,
        leasingStatus: parsed.leasingStatus,
        companyId,
      },
      include: {
        building: { select: { name: true } },
        floor: { select: { name: true } },
        _count: { select: { tenantRooms: true } },
      },
    })

    // 自动计算楼层面积
    await recalculateFloorArea(parsed.floorId)

    return NextResponse.json({ success: true, data: room })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
