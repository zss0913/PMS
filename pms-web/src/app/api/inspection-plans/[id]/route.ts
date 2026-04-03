import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  parseCheckItemsJson,
  validatePlanCheckItems,
  type InspectionCheckItemJson,
} from '@/lib/inspection-check-items'

const checkItemSchema = z.array(
  z.object({
    name: z.string().min(1, '检查项名称不能为空'),
    nfcTagId: z.number().int().positive(),
  })
)

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  inspectionType: z.enum(['工程', '安保', '设备', '绿化']).optional(),
  cycleType: z.enum(['每天', '每周', '每月']).optional(),
  cycleValue: z.number().min(1).optional(),
  cycleWeekday: z.number().int().min(1).max(7).optional().nullable(),
  cycleMonthDay: z.number().int().min(1).max(28).optional().nullable(),
  buildingId: z.number().int().min(1).optional(),
  userIds: z.array(z.number()).optional(),
  checkItems: checkItemSchema.optional(),
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

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
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
          cycleWeekday: plan.cycleWeekday,
          cycleMonthDay: plan.cycleMonthDay,
          userIds: plan.userIds ? (JSON.parse(plan.userIds) as number[]) : [],
          checkItems: parseCheckItemsJson(plan.checkItems),
          buildingId: plan.buildingId,
          status: plan.status,
          createdAt: plan.createdAt.toISOString(),
          updatedAt: plan.updatedAt.toISOString(),
        },
        employees,
        buildings,
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

    const nextType = parsed.inspectionType ?? existing.inspectionType
    const nextBuildingId = parsed.buildingId ?? existing.buildingId
    if (parsed.buildingId !== undefined) {
      const b = await prisma.building.findFirst({
        where: { id: parsed.buildingId, companyId: user.companyId },
      })
      if (!b) {
        return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 400 })
      }
    }

    if (parsed.checkItems !== undefined) {
      const items: InspectionCheckItemJson[] = parsed.checkItems.map((c) => ({
        name: c.name.trim(),
        nfcTagId: c.nfcTagId,
      }))
      if (!nextBuildingId) {
        return NextResponse.json({ success: false, message: '请先为计划选择楼宇' }, { status: 400 })
      }
      const v = await validatePlanCheckItems(prisma, user.companyId, nextType, nextBuildingId, items)
      if (!v.ok) {
        return NextResponse.json({ success: false, message: v.message }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.name !== undefined) updateData.name = parsed.name.trim()
    if (parsed.inspectionType !== undefined) updateData.inspectionType = parsed.inspectionType
    if (parsed.cycleType !== undefined) updateData.cycleType = parsed.cycleType
    if (parsed.cycleValue !== undefined) updateData.cycleValue = parsed.cycleValue
    if (parsed.cycleWeekday !== undefined) updateData.cycleWeekday = parsed.cycleWeekday
    if (parsed.cycleMonthDay !== undefined) updateData.cycleMonthDay = parsed.cycleMonthDay
    if (parsed.buildingId !== undefined) updateData.buildingId = parsed.buildingId
    if (parsed.userIds !== undefined) {
      updateData.userIds = parsed.userIds.length > 0 ? JSON.stringify(parsed.userIds) : null
    }
    if (parsed.checkItems !== undefined) {
      const items: InspectionCheckItemJson[] = parsed.checkItems.map((c) => ({
        name: c.name.trim(),
        nfcTagId: c.nfcTagId,
      }))
      const tags = await prisma.nfcTag.findMany({
        where: { id: { in: items.map((i) => i.nfcTagId) }, companyId: user.companyId },
      })
      const tagMap = new Map(tags.map((t) => [t.id, t]))
      const enriched = items.map((it) => {
        const t = tagMap.get(it.nfcTagId)
        return {
          ...it,
          tagId: t?.tagId,
          location: t ? `${t.location}` : undefined,
        }
      })
      updateData.checkItems = JSON.stringify(enriched)
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
