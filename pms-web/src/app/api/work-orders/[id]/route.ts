import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
})

export async function GET(
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
      include: {
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        tenant: { select: { id: true, companyName: true } },
        assignedEmployee: { select: { id: true, name: true } },
      },
    })

    if (!workOrder) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        workOrder: {
          id: workOrder.id,
          code: workOrder.code,
          title: workOrder.title,
          type: workOrder.type,
          source: workOrder.source,
          description: workOrder.description,
          status: workOrder.status,
          building: workOrder.building,
          room: workOrder.room,
          tenant: workOrder.tenant,
          assignedTo: workOrder.assignedTo,
          assignedEmployee: workOrder.assignedEmployee,
          assignedAt: workOrder.assignedAt?.toISOString() ?? null,
          createdAt: workOrder.createdAt.toISOString(),
          updatedAt: workOrder.updatedAt.toISOString(),
        },
        employees,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function PUT(
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

    const existing = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (parsed.status !== undefined) updateData.status = parsed.status
    if (parsed.title !== undefined) updateData.title = parsed.title
    if (parsed.description !== undefined) updateData.description = parsed.description

    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: updateData,
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
