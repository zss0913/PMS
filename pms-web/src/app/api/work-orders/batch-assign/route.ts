import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

const bodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '请至少选择一条工单'),
  assignedTo: z.number().int().positive(),
})

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
    const parsed = bodySchema.parse(body)
    const uniqueIds = [...new Set(parsed.ids)]

    const employee = await prisma.employee.findFirst({
      where: { id: parsed.assignedTo, companyId: user.companyId, status: 'active' },
    })
    if (!employee) {
      return NextResponse.json({ success: false, message: '处理人不存在或已停用' }, { status: 400 })
    }

    const orders = await prisma.workOrder.findMany({
      where: { id: { in: uniqueIds }, companyId: user.companyId },
    })

    if (orders.length !== uniqueIds.length) {
      return NextResponse.json({ success: false, message: '部分工单不存在或无权限' }, { status: 400 })
    }

    const bad = orders.filter((o) => !['待派单', '待响应'].includes(o.status))
    if (bad.length > 0) {
      return NextResponse.json(
        { success: false, message: '这些状态的不能再派单了' },
        { status: 400 }
      )
    }

    const now = new Date()
    const op = operatorFromAuthUser(user)

    for (const wo of orders) {
      if (wo.status === '待派单') {
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: {
            assignedTo: parsed.assignedTo,
            assignedAt: now,
            status: '待响应',
          },
        })
      } else {
        await prisma.workOrder.update({
          where: { id: wo.id },
          data: {
            assignedTo: parsed.assignedTo,
            assignedAt: now,
          },
        })
      }
      await logWorkOrderActivity(prisma, {
        workOrderId: wo.id,
        workOrderCode: wo.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.ASSIGN,
        summary:
          wo.status === '待派单'
            ? `派单给 ${employee.name}（进入待响应）`
            : `改派给 ${employee.name}（仍为待响应）`,
        meta: { assignedTo: employee.id, assignedName: employee.name, batch: true },
        ...op,
      })
    }

    return NextResponse.json({ success: true, data: { count: orders.length } })
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
