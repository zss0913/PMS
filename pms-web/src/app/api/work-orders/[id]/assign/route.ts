import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const assignSchema = z.object({
  assignedTo: z.number({ required_error: '请选择处理人' }),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: user.companyId },
    })
    if (!workOrder) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    if (workOrder.status !== '待派单') {
      return NextResponse.json(
        { success: false, message: '只有待派单状态的工单可以派单' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = assignSchema.parse(body)

    const employee = await prisma.employee.findFirst({
      where: { id: parsed.assignedTo, companyId: user.companyId, status: 'active' },
    })
    if (!employee) {
      return NextResponse.json({ success: false, message: '处理人不存在或已停用' }, { status: 400 })
    }

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        assignedTo: parsed.assignedTo,
        assignedAt: new Date(),
        status: '待响应',
      },
    })

    return NextResponse.json({ success: true })
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
