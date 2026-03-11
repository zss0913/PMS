import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const INSPECTION_TYPES = ['工程', '安保', '设备', '绿化']
const CYCLE_TYPES = ['每天', '每周', '每月']

const createSchema = z.object({
  name: z.string().min(1, '计划名称必填'),
  inspectionType: z.enum(['工程', '安保', '设备', '绿化']),
  cycleType: z.enum(['每天', '每周', '每月']),
  cycleValue: z.number().min(1).default(1),
  userIds: z.array(z.number()).optional().default([]),
  checkItems: z.any().optional(),
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

    const plans = await prisma.inspectionPlan.findMany({
      where: { companyId: user.companyId },
      orderBy: { id: 'desc' },
    })

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const list = plans.map((p) => ({
      id: p.id,
      name: p.name,
      inspectionType: p.inspectionType,
      cycleType: p.cycleType,
      cycleValue: p.cycleValue,
      cycleLabel: p.cycleValue === 1 ? p.cycleType : `每${p.cycleValue}${p.cycleType.replace('每', '')}`,
      userIds: p.userIds ? (JSON.parse(p.userIds) as number[]) : [],
      checkItems: p.checkItems ? JSON.parse(p.checkItems) : [],
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        list,
        employees,
        inspectionTypes: INSPECTION_TYPES,
        cycleTypes: CYCLE_TYPES,
      },
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

    const plan = await prisma.inspectionPlan.create({
      data: {
        name: parsed.name.trim(),
        inspectionType: parsed.inspectionType,
        cycleType: parsed.cycleType,
        cycleValue: parsed.cycleValue,
        userIds: parsed.userIds.length > 0 ? JSON.stringify(parsed.userIds) : null,
        checkItems: parsed.checkItems ? JSON.stringify(parsed.checkItems) : null,
        status: 'active',
        companyId: user.companyId,
      },
    })

    return NextResponse.json({ success: true, data: { id: plan.id } })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
