import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  const tasks = await prisma.inspectionTask.findMany({
    where: {
      companyId: user.companyId,
      ...(status ? { status } : {}),
    },
    orderBy: { scheduledDate: 'desc' },
  })

  const userId = user.id
  const filtered = tasks.filter((t) => {
    if (!t.userIds) return false
    try {
      const ids = JSON.parse(t.userIds) as number[]
      return ids.includes(userId)
    } catch {
      return false
    }
  })

  const list = filtered.map((t) => ({
    id: t.id,
    code: t.code,
    planName: t.planName,
    inspectionType: t.inspectionType,
    scheduledDate: t.scheduledDate,
    status: t.status,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
  }))

  return NextResponse.json({ success: true, list })
}
