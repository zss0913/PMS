import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { normalizeInspectionTaskStatus } from '@/lib/inspection-task-status'

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
    const status = searchParams.get('status')?.trim() || undefined
    const dateFrom = searchParams.get('dateFrom')?.trim()
    const dateTo = searchParams.get('dateTo')?.trim()
    const buildingIdStr = searchParams.get('buildingId')?.trim()
    const category = searchParams.get('category')?.trim() || ''
    const CATEGORY_KEYS = ['工程', '安保', '设备', '绿化'] as const

    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? '15', 10)
    const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const allowedSizes = [15, 30, 100] as const
    const pageSize = (allowedSizes as readonly number[]).includes(pageSizeRaw)
      ? pageSizeRaw
      : 15

    const where: Record<string, unknown> = { companyId: user.companyId }
    if (status) {
      if (status === '巡检中') {
        where.OR = [{ status: '巡检中' }, { status: '执行中' }]
      } else {
        where.status = status
      }
    }
    if (dateFrom || dateTo) {
      const gte = dateFrom ? new Date(dateFrom + 'T00:00:00') : undefined
      const lte = dateTo ? new Date(dateTo + 'T23:59:59.999') : undefined
      const scheduledFilter: { gte?: Date; lte?: Date } = {}
      if (gte && !Number.isNaN(gte.getTime())) scheduledFilter.gte = gte
      if (lte && !Number.isNaN(lte.getTime())) scheduledFilter.lte = lte
      if (Object.keys(scheduledFilter).length > 0) {
        where.scheduledDate = scheduledFilter
      }
    }
    if (buildingIdStr) {
      const bid = parseInt(buildingIdStr, 10)
      if (!Number.isNaN(bid)) where.buildingId = bid
    }
    if (category && (CATEGORY_KEYS as readonly string[]).includes(category)) {
      where.inspectionType = { startsWith: category }
    }

    const total = await prisma.inspectionTask.count({ where })
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const tasks = await prisma.inspectionTask.findMany({
      where,
      include: {
        plan: { select: { id: true, name: true } },
        building: { select: { id: true, name: true } },
      },
      orderBy: { scheduledDate: 'desc' },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    })

    const employeeIds = new Set<number>()
    tasks.forEach((t) => {
      if (t.userIds) {
        try {
          const ids = JSON.parse(t.userIds) as number[]
          ids.forEach((id) => employeeIds.add(id))
        } catch {
          // ignore
        }
      }
    })

    const assigneeRows =
      employeeIds.size > 0
        ? await prisma.employee.findMany({
            where: { id: { in: Array.from(employeeIds) }, companyId: user.companyId },
            select: { id: true, name: true },
          })
        : []

    const empMap = Object.fromEntries(assigneeRows.map((e) => [e.id, e.name]))

    const list = tasks.map((t) => {
      let personnelNames = '-'
      if (t.userIds) {
        try {
          const ids = JSON.parse(t.userIds) as number[]
          personnelNames = ids.map((id) => empMap[id] ?? '').filter(Boolean).join('、') || '-'
        } catch {
          // ignore
        }
      }
      return {
        id: t.id,
        code: t.code,
        planName: t.plan?.name ?? t.planName,
        inspectionType: t.inspectionType,
        scheduledDate: t.scheduledDate.toISOString(),
        status: normalizeInspectionTaskStatus(t.status),
        buildingId: t.buildingId,
        buildingName: t.building?.name ?? null,
        personnelNames,
      }
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const activePlans = await prisma.inspectionPlan.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['active', '启用'] },
      },
      select: {
        id: true,
        name: true,
        inspectionType: true,
        autoGenerateTasks: true,
        building: { select: { name: true } },
      },
      orderBy: { id: 'desc' },
    })

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: {
        list,
        total,
        page: safePage,
        pageSize,
        totalPages,
        buildings,
        employees,
        statusOptions: ['待执行', '巡检中', '已完成', '已逾期'],
        activePlans: activePlans.map((p) => ({
          id: p.id,
          name: p.name,
          inspectionType: p.inspectionType,
          autoGenerateTasks: p.autoGenerateTasks,
          buildingName: p.building?.name ?? '—',
        })),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
