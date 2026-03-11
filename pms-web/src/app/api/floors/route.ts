import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

// 创建单个楼层
const createSchema = z.object({
  buildingId: z.number(),
  name: z.string().min(1, '楼层名称必填'),
  sort: z.number().default(0),
  area: z.union([z.number(), z.string()]).transform((v) => Number(v)).default(0),
})

// 批量创建楼层
const batchCreateSchema = z.object({
  buildingId: z.number(),
  startFloor: z.number().int().min(-10).max(200),
  endFloor: z.number().int().min(-10).max(200),
  prefix: z.string().default(''),
  suffix: z.string().default(''),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    const buildingId = request.nextUrl.searchParams.get('buildingId')
    if (!buildingId) {
      return NextResponse.json({ success: false, message: '缺少 buildingId' }, { status: 400 })
    }
    const bid = parseInt(buildingId, 10)
    if (isNaN(bid)) {
      return NextResponse.json({ success: false, message: '无效 buildingId' }, { status: 400 })
    }
    const companyId = user.companyId
    const building = await prisma.building.findUnique({
      where: { id: bid },
      select: { companyId: true },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 404 })
    }
    if (companyId > 0 && building.companyId !== companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }
    const floors = await prisma.floor.findMany({
      where: { buildingId: bid },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })
    return NextResponse.json({ success: true, data: floors })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

// 创建单个楼层
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

    // 验证楼宇归属
    const building = await prisma.building.findUnique({
      where: { id: parsed.buildingId },
      select: { companyId: true },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 404 })
    }
    if (building.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    const floor = await prisma.floor.create({
      data: {
        buildingId: parsed.buildingId,
        name: parsed.name,
        sort: parsed.sort,
        area: parsed.area,
      },
    })

    return NextResponse.json({ success: true, data: floor })
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

// 批量创建楼层
export async function PUT(request: NextRequest) {
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
    const parsed = batchCreateSchema.parse(body)

    if (parsed.endFloor < parsed.startFloor) {
      return NextResponse.json(
        { success: false, message: '结束楼层必须大于等于开始楼层' },
        { status: 400 }
      )
    }

    // 验证楼宇归属
    const building = await prisma.building.findUnique({
      where: { id: parsed.buildingId },
      select: { companyId: true },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 404 })
    }
    if (building.companyId !== user.companyId) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }

    // 获取当前最大排序值
    const maxSort = await prisma.floor.findFirst({
      where: { buildingId: parsed.buildingId },
      orderBy: { sort: 'desc' },
      select: { sort: true },
    })
    let currentSort = (maxSort?.sort ?? 0) + 1

    const floors = []
    for (let i = parsed.startFloor; i <= parsed.endFloor; i++) {
      let floorName = `${parsed.prefix}${i}${parsed.suffix}`
      // 处理负数楼层显示
      if (i < 0) {
        floorName = `${parsed.prefix}B${Math.abs(i)}${parsed.suffix}`
      } else if (i === 0) {
        floorName = `${parsed.prefix}G${parsed.suffix}` // 地面层
      }

      floors.push({
        buildingId: parsed.buildingId,
        name: floorName,
        sort: currentSort++,
        area: 0,
      })
    }

    // 使用 createMany 批量创建
    const result = await prisma.floor.createMany({
      data: floors,
      skipDuplicates: false,
    })

    return NextResponse.json({
      success: true,
      message: `成功创建 ${result.count} 个楼层`,
      count: result.count,
    })
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
