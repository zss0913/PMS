import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  parseCheckItemsJson,
  validatePlanCheckItems,
  type InspectionCheckItemJson,
} from '@/lib/inspection-check-items'
import { buildCheckItemsFromInspectionPointIds } from '@/lib/inspection-plan-from-points'
import {
  parseCycleSchedule,
  validateCycleSchedule,
  type CycleScheduleV1,
  type DailySlot,
  type WeeklySlot,
  type MonthlySlot,
} from '@/lib/inspection-cycle-schedule'

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
  cycleSchedule: z.any().optional(),
  requirePhoto: z.boolean().optional(),
  autoGenerateTasks: z.boolean().optional(),
  buildingId: z.number().int().min(1).optional(),
  userIds: z.array(z.number()).optional(),
  inspectionPointIds: z.array(z.number().int().positive()).min(1).optional(),
  checkItems: checkItemSchema.optional(),
  status: z.string().optional(),
})

function normalizeSchedule(cycleType: string, raw: unknown): CycleScheduleV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1 || !Array.isArray(o.slots)) return null
  if (cycleType === '每天') {
    return { v: 1, kind: 'daily', slots: o.slots as DailySlot[] }
  }
  if (cycleType === '每周') {
    return { v: 1, kind: 'weekly', slots: o.slots as WeeklySlot[] }
  }
  if (cycleType === '每月') {
    return { v: 1, kind: 'monthly', slots: o.slots as MonthlySlot[] }
  }
  return null
}

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
          cycleSchedule: parseCycleSchedule(plan.cycleSchedule),
          requirePhoto: plan.requirePhoto,
          autoGenerateTasks: plan.autoGenerateTasks,
          userIds: plan.userIds ? (JSON.parse(plan.userIds) as number[]) : [],
          checkItems: parseCheckItemsJson(plan.checkItems),
          inspectionPointIds: (() => {
            if (!plan.inspectionPointIds?.trim()) return [] as number[]
            try {
              const arr = JSON.parse(plan.inspectionPointIds) as unknown
              return Array.isArray(arr)
                ? arr.filter((x): x is number => typeof x === 'number' && x > 0)
                : []
            } catch {
              return []
            }
          })(),
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

    const nextCycleType = parsed.cycleType ?? existing.cycleType
    const nextCycleValue = parsed.cycleValue ?? existing.cycleValue

    if (parsed.cycleSchedule !== undefined) {
      const scheduleNorm = normalizeSchedule(nextCycleType, parsed.cycleSchedule)
      if (!scheduleNorm) {
        return NextResponse.json({ success: false, message: '请配置周期执行时刻' }, { status: 400 })
      }
      const vs = validateCycleSchedule(nextCycleType, nextCycleValue, scheduleNorm)
      if (!vs.ok) {
        return NextResponse.json({ success: false, message: vs.message }, { status: 400 })
      }
    }

    let resolvedItems: InspectionCheckItemJson[] | undefined
    let resolvedInspectionPointIds: string | null | undefined

    if (parsed.inspectionPointIds !== undefined && parsed.inspectionPointIds.length > 0) {
      if (!nextBuildingId) {
        return NextResponse.json({ success: false, message: '请先为计划选择楼宇' }, { status: 400 })
      }
      const built = await buildCheckItemsFromInspectionPointIds(
        prisma,
        user.companyId,
        nextBuildingId,
        nextType,
        parsed.inspectionPointIds
      )
      if (!built.ok) {
        return NextResponse.json({ success: false, message: built.message }, { status: 400 })
      }
      resolvedItems = built.items
      const seen = new Set<number>()
      const ordered: number[] = []
      for (const pid of parsed.inspectionPointIds) {
        if (!seen.has(pid)) {
          seen.add(pid)
          ordered.push(pid)
        }
      }
      resolvedInspectionPointIds = JSON.stringify(ordered)
    } else if (parsed.checkItems !== undefined) {
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
      resolvedItems = items
      resolvedInspectionPointIds = null
    }

    if (resolvedItems) {
      const v = await validatePlanCheckItems(
        prisma,
        user.companyId,
        nextType,
        nextBuildingId!,
        resolvedItems
      )
      if (!v.ok) {
        return NextResponse.json({ success: false, message: v.message }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.name !== undefined) updateData.name = parsed.name.trim()
    if (parsed.inspectionType !== undefined) updateData.inspectionType = parsed.inspectionType
    if (parsed.cycleType !== undefined) updateData.cycleType = parsed.cycleType
    if (parsed.cycleValue !== undefined) updateData.cycleValue = parsed.cycleValue
    if (parsed.cycleSchedule !== undefined) {
      const scheduleNorm = normalizeSchedule(nextCycleType, parsed.cycleSchedule)
      if (scheduleNorm) updateData.cycleSchedule = JSON.stringify(scheduleNorm)
    }
    if (parsed.requirePhoto !== undefined) updateData.requirePhoto = parsed.requirePhoto
    if (parsed.autoGenerateTasks !== undefined) updateData.autoGenerateTasks = parsed.autoGenerateTasks
    if (parsed.buildingId !== undefined) updateData.buildingId = parsed.buildingId
    if (parsed.userIds !== undefined) {
      updateData.userIds = parsed.userIds.length > 0 ? JSON.stringify(parsed.userIds) : null
    }
    if (resolvedItems) {
      const tags = await prisma.nfcTag.findMany({
        where: { id: { in: resolvedItems.map((i) => i.nfcTagId) }, companyId: user.companyId },
      })
      const tagMap = new Map(tags.map((t) => [t.id, t]))
      const enriched = resolvedItems.map((it) => {
        const t = tagMap.get(it.nfcTagId)
        return {
          ...it,
          tagId: t?.tagId,
          location: t ? `${t.location}` : undefined,
        }
      })
      updateData.checkItems = JSON.stringify(enriched)
    }
    if (resolvedInspectionPointIds !== undefined) {
      updateData.inspectionPointIds = resolvedInspectionPointIds
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
