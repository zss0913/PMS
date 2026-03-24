import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mpEmployeeWorkOrderVisibilityWhere } from '@/lib/mp-employee-work-order-scope'

/** 巡检任务：视为「待办」的状态（与库内历史值兼容） */
const ACTIVE_INSPECTION_STATUSES = ['待巡检', 'pending', '待执行', '执行中', '进行中']

const TODO_WORK_ORDER_STATUSES = [
  '待派单',
  '待响应',
  '处理中',
  '待员工确认费用',
  '待租客确认费用',
] as const

/** 员工端：待办列表（工单 + 巡检）+ 汇总数字 */
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

  const baseWo = mpEmployeeWorkOrderVisibilityWhere(authUser)
  const woListWhere: Prisma.WorkOrderWhereInput = {
    AND: [baseWo, { status: { in: [...TODO_WORK_ORDER_STATUSES] } }],
  }

  const [woRows, inspectionRaw] = await Promise.all([
    prisma.workOrder.findMany({
      where: woListWhere,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, code: true, title: true, type: true, status: true },
    }),
    prisma.inspectionTask.findMany({
      where: {
        companyId,
        status: { in: ACTIVE_INSPECTION_STATUSES },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 100,
      select: {
        id: true,
        code: true,
        planName: true,
        inspectionType: true,
        status: true,
        userIds: true,
      },
    }),
  ])

  const inspectionTasks = inspectionRaw
    .filter((t) => {
      if (!t.userIds) return false
      try {
        const ids = JSON.parse(t.userIds) as number[]
        return ids.includes(userId)
      } catch {
        return false
      }
    })
    .slice(0, 40)
    .map((t) => ({
      id: t.id,
      code: t.code,
      title: t.planName,
      type: t.inspectionType,
      status: t.status,
    }))

  const workOrders = woRows.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    type: o.type,
    status: o.status,
  }))

  const [pendingAssign, pendingProcess, pendingInspection, overdueBills] = await Promise.all([
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
    Promise.resolve(inspectionTasks.length),
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
    data: {
      workOrders,
      inspectionTasks,
    },
    todos: {
      pendingAssign,
      pendingProcess,
      pendingInspection,
      overdueBills,
    },
  })
}
