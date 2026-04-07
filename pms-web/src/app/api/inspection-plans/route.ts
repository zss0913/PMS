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
  formatCycleScheduleSummary,
  type CycleScheduleV1,
  type DailySlot,
  type WeeklySlot,
  type MonthlySlot,
} from '@/lib/inspection-cycle-schedule'

const INSPECTION_TYPES = ['工程', '安保', '设备', '绿化']
const CYCLE_TYPES = ['每天', '每周', '每月']

const createSchema = z.object({
  name: z.string().min(1, '计划名称必填'),
  inspectionType: z.enum(['工程', '安保', '设备', '绿化']),
  cycleType: z.enum(['每天', '每周', '每月']),
  cycleValue: z.number().min(1).default(1),
  /** JSON：{ v, kind, slots } */
  cycleSchedule: z.any(),
  requirePhoto: z.boolean().optional().default(true),
  buildingId: z.number().int().min(1, '请选择楼宇'),
  userIds: z.array(z.number()).optional().default([]),
  inspectionPointIds: z.array(z.number().int().positive()).min(1, '请至少选择一个巡检点'),
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

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const list = plans.map((p) => {
      let inspectionPointIds: number[] = []
      if (p.inspectionPointIds?.trim()) {
        try {
          const arr = JSON.parse(p.inspectionPointIds) as unknown
          if (Array.isArray(arr)) {
            inspectionPointIds = arr.filter((x): x is number => typeof x === 'number' && x > 0)
          }
        } catch {
          inspectionPointIds = []
        }
      }
      const scheduleObj = parseCycleSchedule(p.cycleSchedule)
      return {
        id: p.id,
        name: p.name,
        inspectionType: p.inspectionType,
        cycleType: p.cycleType,
        cycleValue: p.cycleValue,
        cycleWeekday: p.cycleWeekday,
        cycleMonthDay: p.cycleMonthDay,
        cycleSchedule: scheduleObj,
        requirePhoto: p.requirePhoto,
        cycleLabel: formatCycleScheduleSummary(p.cycleType, p.cycleValue, p.cycleSchedule),
        userIds: p.userIds ? (JSON.parse(p.userIds) as number[]) : [],
        checkItems: parseCheckItemsJson(p.checkItems),
        inspectionPointIds,
        buildingId: p.buildingId,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        list,
        employees,
        buildings,
        inspectionTypes: INSPECTION_TYPES,
        cycleTypes: CYCLE_TYPES,
        cycleWeekdayOptions: [
          { value: 1, label: '周一' },
          { value: 2, label: '周二' },
          { value: 3, label: '周三' },
          { value: 4, label: '周四' },
          { value: 5, label: '周五' },
          { value: 6, label: '周六' },
          { value: 7, label: '周日' },
        ],
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

    const scheduleNorm = normalizeSchedule(parsed.cycleType, parsed.cycleSchedule)
    if (!scheduleNorm) {
      return NextResponse.json({ success: false, message: '请配置周期执行时刻' }, { status: 400 })
    }
    const vs = validateCycleSchedule(parsed.cycleType, parsed.cycleValue, scheduleNorm)
    if (!vs.ok) {
      return NextResponse.json({ success: false, message: vs.message }, { status: 400 })
    }

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId: user.companyId },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 400 })
    }

    const built = await buildCheckItemsFromInspectionPointIds(
      prisma,
      user.companyId,
      parsed.buildingId,
      parsed.inspectionType,
      parsed.inspectionPointIds
    )
    if (!built.ok) {
      return NextResponse.json({ success: false, message: built.message }, { status: 400 })
    }
    const items: InspectionCheckItemJson[] = built.items

    const v = await validatePlanCheckItems(prisma, user.companyId, parsed.inspectionType, parsed.buildingId, items)
    if (!v.ok) {
      return NextResponse.json({ success: false, message: v.message }, { status: 400 })
    }

    const seen = new Set<number>()
    const ordered: number[] = []
    for (const id of parsed.inspectionPointIds) {
      if (!seen.has(id)) {
        seen.add(id)
        ordered.push(id)
      }
    }
    const inspectionPointIdsJson = JSON.stringify(ordered)

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

    const plan = await prisma.inspectionPlan.create({
      data: {
        name: parsed.name.trim(),
        inspectionType: parsed.inspectionType,
        cycleType: parsed.cycleType,
        cycleValue: parsed.cycleValue,
        cycleWeekday: null,
        cycleMonthDay: null,
        cycleSchedule: JSON.stringify(scheduleNorm),
        requirePhoto: parsed.requirePhoto,
        buildingId: parsed.buildingId,
        userIds: parsed.userIds.length > 0 ? JSON.stringify(parsed.userIds) : null,
        checkItems: JSON.stringify(enriched),
        inspectionPointIds: inspectionPointIdsJson,
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
