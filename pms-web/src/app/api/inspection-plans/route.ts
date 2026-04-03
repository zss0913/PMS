import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  parseCheckItemsJson,
  validatePlanCheckItems,
  type InspectionCheckItemJson,
} from '@/lib/inspection-check-items'

const INSPECTION_TYPES = ['工程', '安保', '设备', '绿化']
const CYCLE_TYPES = ['每天', '每周', '每月']

const checkItemSchema = z.array(
  z.object({
    name: z.string().min(1, '检查项名称不能为空'),
    nfcTagId: z.number().int().positive(),
  })
)

const createSchema = z.object({
  name: z.string().min(1, '计划名称必填'),
  inspectionType: z.enum(['工程', '安保', '设备', '绿化']),
  cycleType: z.enum(['每天', '每周', '每月']),
  cycleValue: z.number().min(1).default(1),
  cycleWeekday: z.number().int().min(1).max(7).optional().nullable(),
  cycleMonthDay: z.number().int().min(1).max(28).optional().nullable(),
  buildingId: z.number().int().min(1, '请选择楼宇'),
  userIds: z.array(z.number()).optional().default([]),
  checkItems: checkItemSchema.optional().default([]),
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

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const list = plans.map((p) => ({
      id: p.id,
      name: p.name,
      inspectionType: p.inspectionType,
      cycleType: p.cycleType,
      cycleValue: p.cycleValue,
      cycleWeekday: p.cycleWeekday,
      cycleMonthDay: p.cycleMonthDay,
      cycleLabel: p.cycleValue === 1 ? p.cycleType : `每${p.cycleValue}${p.cycleType.replace('每', '')}`,
      userIds: p.userIds ? (JSON.parse(p.userIds) as number[]) : [],
      checkItems: parseCheckItemsJson(p.checkItems),
      buildingId: p.buildingId,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }))

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

    const building = await prisma.building.findFirst({
      where: { id: parsed.buildingId, companyId: user.companyId },
    })
    if (!building) {
      return NextResponse.json({ success: false, message: '楼宇不存在' }, { status: 400 })
    }

    const items: InspectionCheckItemJson[] = parsed.checkItems.map((c) => ({
      name: c.name.trim(),
      nfcTagId: c.nfcTagId,
    }))
    const v = await validatePlanCheckItems(prisma, user.companyId, parsed.inspectionType, parsed.buildingId, items)
    if (!v.ok) {
      return NextResponse.json({ success: false, message: v.message }, { status: 400 })
    }

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
        cycleWeekday: parsed.cycleWeekday ?? null,
        cycleMonthDay: parsed.cycleMonthDay ?? null,
        buildingId: parsed.buildingId,
        userIds: parsed.userIds.length > 0 ? JSON.stringify(parsed.userIds) : null,
        checkItems: JSON.stringify(enriched),
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
