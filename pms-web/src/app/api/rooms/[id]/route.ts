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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  roomNumber: z.string().min(1).optional(),
  area: z.number().min(0).optional(),
  buildingId: z.number().optional(),
  floorId: z.number().optional(),
  type: z.enum(['商铺', '写字楼', '住宅']).optional(),
  status: z.enum(['空置', '已租', '自用']).optional(),
  leasingStatus: z.enum(['可招商', '不可招商']).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const id = parseInt((await params).id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: '无效ID' }, { status: 400 })
    }
    const companyId = user.companyId
    const existing = await prisma.room.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '房源不存在' }, { status: 404 })
    }
    if (companyId > 0 && existing.companyId !== companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }
    const body = await request.json()
    const parsed = updateSchema.parse(body)

    // 记录原楼层ID，用于后续面积重算
    const originalFloorId = existing.floorId
    const newFloorId = parsed.floorId

    const room = await prisma.room.update({
      where: { id },
      data: parsed,
      include: {
        building: { select: { name: true } },
        floor: { select: { name: true } },
        _count: { select: { tenantRooms: true } },
      },
    })

    // 重新计算楼层面积
    if (newFloorId && newFloorId !== originalFloorId) {
      // 如果楼层变更，需要重新计算原楼层和新楼层的面积
      await recalculateFloorArea(originalFloorId)
      await recalculateFloorArea(newFloorId)
    } else {
      // 否则只重新计算当前楼层面积
      await recalculateFloorArea(originalFloorId)
    }

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const id = parseInt((await params).id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: '无效ID' }, { status: 400 })
    }
    const companyId = user.companyId
    const existing = await prisma.room.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: '房源不存在' }, { status: 404 })
    }
    if (companyId > 0 && existing.companyId !== companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    // 记录楼层ID用于后续面积重算
    const floorId = existing.floorId

    await prisma.room.delete({ where: { id } })

    // 重新计算楼层面积
    await recalculateFloorArea(floorId)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
