import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1, '类型名称不能为空'),
  sort: z.number().int().optional().default(0),
  enabled: z.boolean().optional().default(true),
  responseTimeoutHours: z.number().int().min(0).nullable().optional(),
  notifyLeaderOnTimeout: z.boolean().optional().default(false),
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

    const types = await prisma.workOrderType.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    })

    const workOrderCounts = await prisma.workOrder.groupBy({
      by: ['type'],
      where: { companyId: user.companyId },
      _count: { id: true },
    })
    const countMap = Object.fromEntries(
      workOrderCounts.map((c) => [c.type, c._count.id])
    )

    const list = types.map((t) => ({
      id: t.id,
      name: t.name,
      sort: t.sort,
      enabled: t.enabled,
      companyId: t.companyId,
      workOrderCount: countMap[t.name] ?? 0,
      responseTimeoutHours: t.responseTimeoutHours,
      notifyLeaderOnTimeout: t.notifyLeaderOnTimeout,
    }))

    return NextResponse.json({ success: true, data: list })
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

    const exists = await prisma.workOrderType.findFirst({
      where: { name: parsed.name, companyId: user.companyId },
    })
    if (exists) {
      return NextResponse.json(
        { success: false, message: '该工单类型名称已存在' },
        { status: 400 }
      )
    }

    const created = await prisma.workOrderType.create({
      data: {
        name: parsed.name,
        sort: parsed.sort,
        enabled: parsed.enabled,
        responseTimeoutHours: parsed.responseTimeoutHours ?? null,
        notifyLeaderOnTimeout: parsed.notifyLeaderOnTimeout ?? false,
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
