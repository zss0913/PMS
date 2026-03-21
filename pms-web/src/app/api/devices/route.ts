import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const DEVICE_STATUSES = ['正常', '维修中', '报废'] as const

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '投用日期格式须为 YYYY-MM-DD')

const createSchema = z.object({
  code: z.string().min(1, '设备编号不能为空'),
  name: z.string().min(1, '设备名称不能为空'),
  type: z.string().min(1, '设备类型不能为空'),
  buildingId: z.number().int().min(1, '请选择所属楼宇'),
  status: z.enum(DEVICE_STATUSES).default('正常'),
  commissionedDate: dateStr.optional(),
  location: z.string().optional(),
  maintenanceContact: z.string().optional(),
  supplier: z.string().optional(),
  brand: z.string().optional(),
})

function parseCommissionedDate(s: string | undefined): Date {
  if (!s?.trim()) return new Date()
  const d = new Date(s.trim() + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? new Date() : d
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
      maintenanceContact: d.maintenanceContact,
      brand: d.brand,
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

    const code = parsed.code.trim()
    const codeTaken = await prisma.device.findFirst({
      where: { companyId: user.companyId, code },
    })
    if (codeTaken) {
      return NextResponse.json(
        { success: false, message: '该设备编号已存在，同一物业公司下设备编号不能重复' },
        { status: 400 }
      )
    }

    const created = await prisma.device.create({
      data: {
        code,
        name: parsed.name,
        type: parsed.type,
        buildingId: parsed.buildingId,
        status: parsed.status,
        location: parsed.location ?? '',
        commissionedDate: parseCommissionedDate(parsed.commissionedDate),
        supplier: parsed.supplier ?? '',
        maintenanceContact: parsed.maintenanceContact || null,
        brand: parsed.brand || null,
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
