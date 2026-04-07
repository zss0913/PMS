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

  const status = request.nextUrl.searchParams.get('status')
  const where: {
    companyId: number
    OR?: ({ status: string } | { status: string })[]
    status?: string
  } = { companyId: user.companyId }
  if (status) {
    if (status === '巡检中') {
      where.OR = [{ status: '巡检中' }, { status: '执行中' }]
    } else {
      where.status = status
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

  const list = filtered.map((t) => ({
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

  return NextResponse.json({ success: true, data: { list } })
}
