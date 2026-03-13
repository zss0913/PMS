import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DEVICE_STATUSES = ['正常', '维修中', '报废'] as const

const updateSchema = z.object({
  name: z.string().min(1, '设备名称不能为空').optional(),
  type: z.string().min(1, '设备类型不能为空').optional(),
  buildingId: z.number().int().min(1).optional(),
  status: z.enum(DEVICE_STATUSES).optional(),
  location: z.string().optional(),
  maintenanceContact: z.string().optional(),
  supplier: z.string().optional(),
  brand: z.string().optional(),
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
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const { id } = await params
    const deviceId = parseInt(id, 10)
    if (isNaN(deviceId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.device.findFirst({
      where: { id: deviceId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '设备不存在' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    if (parsed.buildingId) {
      const building = await prisma.building.findFirst({
        where: { id: parsed.buildingId, companyId: user.companyId },
      })
      if (!building) {
        return NextResponse.json(
          { success: false, message: '楼宇不存在' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.type !== undefined && { type: parsed.type }),
        ...(parsed.buildingId && { buildingId: parsed.buildingId }),
        ...(parsed.status && { status: parsed.status }),
        ...(parsed.location !== undefined && { location: parsed.location ?? '' }),
        ...(parsed.maintenanceContact !== undefined && { maintenanceContact: parsed.maintenanceContact || null }),
        ...(parsed.supplier !== undefined && { supplier: parsed.supplier ?? '' }),
        ...(parsed.brand !== undefined && { brand: parsed.brand || null }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}

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
    const deviceId = parseInt(id, 10)
    if (isNaN(deviceId)) {
      return NextResponse.json(
        { success: false, message: '无效的ID' },
        { status: 400 }
      )
    }

    const existing = await prisma.device.findFirst({
      where: { id: deviceId, companyId: user.companyId },
      include: { _count: { select: { maintenances: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: '设备不存在' },
        { status: 404 }
      )
    }

    if (existing._count.maintenances > 0) {
      return NextResponse.json(
        { success: false, message: `该设备有 ${existing._count.maintenances} 条维保记录，无法删除` },
        { status: 400 }
      )
    }

    await prisma.device.delete({ where: { id: deviceId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}
