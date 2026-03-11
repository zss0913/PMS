import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DEVICE_STATUSES = ['正常', '维修中', '报废'] as const

const createSchema = z.object({
  name: z.string().min(1, '设备名称不能为空'),
  type: z.string().min(1, '设备类型不能为空'),
  buildingId: z.number().int().min(1, '请选择所属楼宇'),
  status: z.enum(DEVICE_STATUSES).default('正常'),
})

function generateDeviceCode(): string {
  return `DEV-${Date.now().toString(36).toUpperCase()}`
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

    const devices = await prisma.device.findMany({
      where: { companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const list = devices.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.type,
      buildingId: d.buildingId,
      buildingName: d.building.name,
      status: d.status,
      location: d.location,
      commissionedDate: d.commissionedDate.toISOString().slice(0, 10),
      supplier: d.supplier,
      contactPhone: d.contactPhone,
      tagId: d.tagId,
    }))

    return NextResponse.json({ success: true, data: { list, buildings } })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { success: false, message: '楼宇不存在' },
        { status: 400 }
      )
    }

    const code = generateDeviceCode()
    const created = await prisma.device.create({
      data: {
        code,
        name: parsed.name,
        type: parsed.type,
        buildingId: parsed.buildingId,
        status: parsed.status,
        location: '',
        commissionedDate: new Date(),
        supplier: '',
        companyId: user.companyId,
      },
    })

    return NextResponse.json({ success: true, data: created })
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
