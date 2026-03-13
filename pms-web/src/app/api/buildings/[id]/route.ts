import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const updateSchema = z.object({
  name: z.string().min(1, '楼宇名称必填'),
  area: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  manager: z.string().min(1, '负责人必填'),
  phone: z.string().min(1, '联系电话必填'),
  location: z.string().optional().nullable(),
  projectId: z.number().optional().nullable(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const { id } = await params
    const buildingId = parseInt(id, 10)
    if (isNaN(buildingId)) {
      return NextResponse.json({ success: false, message: '无效的楼宇ID' }, { status: 400 })
    }

    const where = user.companyId > 0 ? { id: buildingId, companyId: user.companyId } : { id: buildingId }
    const building = await prisma.building.findFirst({
      where,
      include: {
        project: { select: { id: true, name: true } },
        floors: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
      },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...building,
        area: Number(building.area),
        floors: building.floors.map((f) => ({ ...f, area: Number(f.area) })),
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
    const buildingId = parseInt(id, 10)
    if (isNaN(buildingId)) {
      return NextResponse.json({ success: false, message: '无效的楼宇ID' }, { status: 400 })
    }

    const existing = await prisma.building.findFirst({
      where: { id: buildingId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    await prisma.building.update({
      where: { id: buildingId },
      data: {
        name: parsed.name,
        area: new Decimal(parsed.area),
        manager: parsed.manager,
        phone: parsed.phone,
        location: parsed.location ?? null,
        projectId: parsed.projectId ?? null,
      },
    })

    return NextResponse.json({ success: true })
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
    const buildingId = parseInt(id, 10)
    if (isNaN(buildingId)) {
      return NextResponse.json({ success: false, message: '无效的楼宇ID' }, { status: 400 })
    }

    const building = await prisma.building.findFirst({
      where: { id: buildingId, companyId: user.companyId },
      include: { _count: { select: { rooms: true } } },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 404 })
    }

    if (building._count.rooms > 0) {
      return NextResponse.json(
        { success: false, message: '楼宇下存在房源无法删除' },
        { status: 400 }
      )
    }

    await prisma.building.delete({
      where: { id: buildingId },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
