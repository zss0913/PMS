import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeInspectionTaskStatus } from '@/lib/inspection-task-status'

/** 员工端：获取待巡检任务列表 */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
    )
  }

  const status = request.nextUrl.searchParams.get('status')?.trim()
  const category = request.nextUrl.searchParams.get('category')?.trim()
  const dateFrom = request.nextUrl.searchParams.get('dateFrom')?.trim()
  const dateTo = request.nextUrl.searchParams.get('dateTo')?.trim()
  const pageRaw = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
  const pageSizeRaw = parseInt(request.nextUrl.searchParams.get('pageSize') ?? '15', 10)
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const pageSize = Number.isInteger(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(pageSizeRaw, 50) : 15
  const CATEGORY_PREFIXES = ['工程', '安保', '设备', '绿化'] as const

  const where: {
    companyId: number
    OR?: ({ status: string } | { status: string })[]
    status?: string
    inspectionType?: { startsWith: string }
    scheduledDate?: { gte?: Date; lte?: Date }
  } = { companyId: user.companyId }
  if (status) {
    if (status === '巡检中') {
      where.OR = [{ status: '巡检中' }, { status: '执行中' }]
    } else {
      where.status = status
    }
  }
  if (category && (CATEGORY_PREFIXES as readonly string[]).includes(category)) {
    where.inspectionType = { startsWith: category }
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

  const tasks = await prisma.inspectionTask.findMany({
    where,
    include: { building: { select: { name: true } } },
    orderBy: { scheduledDate: 'desc' },
  })

  const userId = user.id
  const filtered = tasks.filter((t) => {
    if (!t.userIds?.trim()) return true
    try {
      const ids = JSON.parse(t.userIds) as number[]
      return Array.isArray(ids) && ids.includes(userId)
    } catch {
      return false
    }
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)

  const list = pageRows.map((t) => ({
    id: t.id,
    code: t.code,
    planName: t.planName,
    inspectionType: t.inspectionType,
    scheduledDate: t.scheduledDate.toISOString(),
    status: normalizeInspectionTaskStatus(t.status),
    buildingName: t.building?.name ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    requirePhoto: t.requirePhoto,
  }))

  return NextResponse.json({
    success: true,
    data: {
      list,
      total,
      page: safePage,
      pageSize,
      hasMore: start + pageSize < total,
    },
  })
}
