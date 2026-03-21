import { NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 员工端：待办汇总（待派工单、待处理工单、待巡检任务、逾期账单） */
export async function GET(request: Request) {
  const authUser = await getMpAuthUser(request)
  if (!authUser || authUser.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
    )
  }

  const userId = authUser.id
  const companyId = authUser.companyId
  const isLeader = authUser.isLeader ?? false

  const [pendingAssign, pendingProcess, pendingInspection, overdueBills] =
    await Promise.all([
      isLeader
        ? prisma.workOrder.count({
            where: { companyId, status: '待派单' },
          })
        : 0,
      prisma.workOrder.count({
        where: {
          companyId,
          assignedTo: userId,
          status: { in: ['待响应', '处理中'] },
        },
      }),
      prisma.inspectionTask.findMany({
        where: {
          companyId,
          status: { in: ['待巡检', 'pending', '进行中'] },
        },
        select: { userIds: true },
      }).then((tasks) =>
        tasks.filter((t) => {
          if (!t.userIds) return false
          try {
            const ids = JSON.parse(t.userIds) as number[]
            return ids.includes(userId)
          } catch {
            return false
          }
        }).length
      ),
      prisma.bill.count({
        where: {
          companyId,
          status: 'open',
          paymentStatus: { not: 'paid' },
          dueDate: { lt: new Date() },
        },
      }),
    ])

  return NextResponse.json({
    success: true,
    todos: {
      pendingAssign,
      pendingProcess,
      pendingInspection,
      overdueBills,
    },
  })
}
