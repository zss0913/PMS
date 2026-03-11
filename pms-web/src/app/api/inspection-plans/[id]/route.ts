import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  inspectionType: z.enum(['工程', '安保', '设备', '绿化']).optional(),
  cycleType: z.enum(['每天', '每周', '每月']).optional(),
  cycleValue: z.number().min(1).optional(),
  userIds: z.array(z.number()).optional(),
  checkItems: z.any().optional(),
  status: z.string().optional(),
})

export async function GET(
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
    const planId = parseInt(id, 10)
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, message: '无效的计划ID' }, { status: 400 })
    }

    const plan = await prisma.inspectionPlan.findFirst({
      where: { id: planId, companyId: user.companyId },
    })

    if (!plan) {
      return NextResponse.json({ success: false, message: '计划不存在' }, { status: 404 })
    }

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        plan: {
          id: plan.id,
          name: plan.name,
          inspectionType: plan.inspectionType,
          cycleType: plan.cycleType,
          cycleValue: plan.cycleValue,
          userIds: plan.userIds ? (JSON.parse(plan.userIds) as number[]) : [],
          checkItems: plan.checkItems ? JSON.parse(plan.checkItems) : [],
          status: plan.status,
          createdAt: plan.createdAt.toISOString(),
          updatedAt: plan.updatedAt.toISOString(),
        },
        employees,
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
    const planId = parseInt(id, 10)
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, message: '无效的计划ID' }, { status: 400 })
    }

    const existing = await prisma.inspectionPlan.findFirst({
      where: { id: planId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '计划不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (parsed.name !== undefined) updateData.name = parsed.name.trim()
    if (parsed.inspectionType !== undefined) updateData.inspectionType = parsed.inspectionType
    if (parsed.cycleType !== undefined) updateData.cycleType = parsed.cycleType
    if (parsed.cycleValue !== undefined) updateData.cycleValue = parsed.cycleValue
    if (parsed.userIds !== undefined) {
      updateData.userIds = parsed.userIds.length > 0 ? JSON.stringify(parsed.userIds) : null
    }
    if (parsed.checkItems !== undefined) {
      updateData.checkItems = parsed.checkItems ? JSON.stringify(parsed.checkItems) : null
    }
    if (parsed.status !== undefined) updateData.status = parsed.status

    await prisma.inspectionPlan.update({
      where: { id: planId },
      data: updateData,
    })

    return NextResponse.json({ success: true })
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
    const planId = parseInt(id, 10)
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, message: '无效的计划ID' }, { status: 400 })
    }

    const existing = await prisma.inspectionPlan.findFirst({
      where: { id: planId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '计划不存在' }, { status: 404 })
    }

    await prisma.inspectionPlan.delete({ where: { id: planId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
