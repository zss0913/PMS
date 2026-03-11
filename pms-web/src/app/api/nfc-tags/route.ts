import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const INSPECTION_TYPES = ['工程', '安保', '设备', '绿化'] as const

const createSchema = z.object({
  tagId: z.string().min(1, 'NFC ID不能为空'),
  buildingId: z.number().int().min(1, '请选择所属楼宇'),
  location: z.string().min(1, '位置名称不能为空'),
  description: z.string().optional().default(''),
  inspectionType: z.enum(INSPECTION_TYPES),
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

    const tags = await prisma.nfcTag.findMany({
      where: { companyId: user.companyId },
      include: {
        building: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const list = tags.map((t) => ({
      id: t.id,
      tagId: t.tagId,
      buildingId: t.buildingId,
      buildingName: t.building.name,
      location: t.location,
      description: t.description,
      inspectionType: t.inspectionType,
      companyId: t.companyId,
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

    const tagIdExists = await prisma.nfcTag.findFirst({
      where: { tagId: parsed.tagId, companyId: user.companyId },
    })
    if (tagIdExists) {
      return NextResponse.json(
        { success: false, message: '该NFC ID已存在' },
        { status: 400 }
      )
    }

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId: user.companyId },
    })
    if (!building) {
      return NextResponse.json(
        { success: false, message: '楼宇不存在' },
        { status: 400 }
      )
    }

    const created = await prisma.nfcTag.create({
      data: {
        tagId: parsed.tagId,
        buildingId: parsed.buildingId,
        location: parsed.location,
        description: parsed.description ?? '',
        inspectionType: parsed.inspectionType,
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
