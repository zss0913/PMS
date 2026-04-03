import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 员工端：巡检任务详情（同公司即可查看，便于从消息通知进入） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
    )
  }

  const { id } = await params
  const taskId = parseInt(id, 10)
  if (Number.isNaN(taskId)) {
    return NextResponse.json({ success: false, message: '无效的任务ID' }, { status: 400 })
  }

  const task = await prisma.inspectionTask.findFirst({
    where: { id: taskId, companyId: user.companyId },
  })

  if (!task) {
    return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 })
  }

  let userIds: number[] = []
  if (task.userIds) {
    try {
      userIds = JSON.parse(task.userIds) as number[]
      if (!Array.isArray(userIds)) userIds = []
    } catch {
      userIds = []
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: task.id,
      code: task.code,
      planName: task.planName,
      inspectionType: task.inspectionType,
      scheduledDate: task.scheduledDate.toISOString(),
      status: task.status,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      userIds,
      route: task.route,
      checkItems: task.checkItems,
    },
  })
}
