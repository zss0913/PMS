import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

// 更新楼层
const updateSchema = z.object({
  name: z.string().min(1, '楼层名称必填').optional(),
  sort: z.number().optional(),
  area: z.union([z.number(), z.string()]).transform((v) => Number(v)).optional(),
})

// 获取单个楼层
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const { id } = await params
    const floorId = parseInt(id, 10)
    if (isNaN(floorId)) {
      return NextResponse.json({ success: false, message: '无效楼层ID' }, { status: 400 })
    }

    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      include: { building: { select: { companyId: true } } },
    })

    if (!floor) {
      return NextResponse.json({ success: false, message: '楼层不存在' }, { status: 404 })
    }

    if (user.companyId > 0 && floor.building.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: floor })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

// 更新楼层
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
    const floorId = parseInt(id, 10)
    if (isNaN(floorId)) {
      return NextResponse.json({ success: false, message: '无效楼层ID' }, { status: 400 })
    }

    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      include: { building: { select: { companyId: true } } },
    })

    if (!floor) {
      return NextResponse.json({ success: false, message: '楼层不存在' }, { status: 404 })
    }

    if (floor.building.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const updated = await prisma.floor.update({
      where: { id: floorId },
      data: parsed,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message || '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

// 删除楼层
export async function DELETE(
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
    const floorId = parseInt(id, 10)
    if (isNaN(floorId)) {
      return NextResponse.json({ success: false, message: '无效楼层ID' }, { status: 400 })
    }

    const floor = await prisma.floor.findUnique({
      where: { id: floorId },
      include: {
        building: { select: { companyId: true } },
        _count: { select: { rooms: true } },
      },
    })

    if (!floor) {
      return NextResponse.json({ success: false, message: '楼层不存在' }, { status: 404 })
    }

    if (floor.building.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    // 检查是否有房源关联
    if (floor._count.rooms > 0) {
      return NextResponse.json(
        { success: false, message: '该楼层下存在房源，请先删除房源后再删除楼层' },
        { status: 400 }
      )
    }

    await prisma.floor.delete({ where: { id: floorId } })

    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
