import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const createSchema = z.object({
  name: z.string().min(1, '项目名称必填'),
  location: z.string().optional().nullable(),
  area: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  greenArea: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  manager: z.string().min(1, '负责人必填'),
  phone: z.string().min(1, '联系电话必填'),
  buildingIds: z.array(z.number()).min(1, '至少选择一个关联楼宇'),
})

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
  }
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
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword')?.trim() || ''

    const where: { companyId: number; name?: { contains: string } } = {
      companyId: user.companyId,
    }
    if (keyword) {
      where.name = { contains: keyword }
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: { select: { buildings: true } },
      },
      orderBy: { id: 'asc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
    })

    const list = projects.map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location,
      area: Number(p.area),
      greenArea: Number(p.greenArea),
      manager: p.manager,
      phone: p.phone,
      buildingIds: parseJsonIds(p.buildingIds),
      buildingCount: p._count.buildings,
      createdAt: p.createdAt,
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

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: parsed.name,
          location: parsed.location ?? null,
          area: new Decimal(parsed.area),
          greenArea: new Decimal(parsed.greenArea),
          manager: parsed.manager,
          phone: parsed.phone,
          buildingIds: JSON.stringify(parsed.buildingIds),
          companyId: user.companyId,
        },
      })
      await tx.building.updateMany({
        where: { id: { in: parsed.buildingIds }, companyId: user.companyId },
        data: { projectId: created.id },
      })
      return created
    })

    return NextResponse.json({ success: true, data: project })
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
