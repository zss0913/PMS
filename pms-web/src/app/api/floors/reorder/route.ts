import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const reorderSchema = z.object({
  buildingId: z.number(),
  floorIds: z.array(z.number()), // 按新顺序排列的楼层ID数组
})

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
    const parsed = reorderSchema.parse(body)

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

    // 验证所有楼层都属于该楼宇
    const floors = await prisma.floor.findMany({
      where: {
        id: { in: parsed.floorIds },
        buildingId: parsed.buildingId,
      },
      select: { id: true },
    })
    if (floors.length !== parsed.floorIds.length) {
      return NextResponse.json(
        { success: false, message: '部分楼层不属于该楼宇' },
        { status: 400 }
      )
    }

    // 批量更新排序
    const updates = parsed.floorIds.map((id, index) =>
      prisma.floor.update({
        where: { id },
        data: { sort: index + 1 },
      })
    )

    await prisma.$transaction(updates)

    return NextResponse.json({ success: true, message: '排序调整成功' })
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
