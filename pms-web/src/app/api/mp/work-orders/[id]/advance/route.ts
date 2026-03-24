import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  runWorkOrderAdvance,
  workOrderAdvanceBodySchema,
} from '@/lib/work-order-advance'
import { mpEmployeeWorkOrderVisibilityWhere } from '@/lib/mp-employee-work-order-scope'

/** 员工端：全流程推进；租客端：仅允许「取消工单」（与详情可见范围一致） */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const body = await request.json()
    const parsed = workOrderAdvanceBodySchema.parse(body)

    if (user.type === 'tenant') {
      if (parsed.action !== 'cancel' && parsed.action !== 'submit_tenant_evaluation') {
        return NextResponse.json(
          { success: false, message: '仅物业员工可执行该操作' },
          { status: 403 }
        )
      }
      const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
      if (tenantIds.length === 0) {
        return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
      }
      const tenantWhere: Prisma.WorkOrderWhereInput = {
        id: workOrderId,
        companyId: user.companyId,
        OR: [{ tenantId: { in: tenantIds } }, { reporterId: user.id }],
      }
      const visible = await prisma.workOrder.findFirst({ where: tenantWhere, select: { id: true } })
      if (!visible) {
        return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
      }
      const r = await runWorkOrderAdvance(user, workOrderId, parsed)
      if (!r.ok) {
        return NextResponse.json({ success: false, message: r.message }, { status: r.status })
      }
      return NextResponse.json({ success: true })
    }

    if (user.type !== 'employee' || user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '仅物业员工可操作' },
        { status: 403 }
      )
    }

    const vis = mpEmployeeWorkOrderVisibilityWhere(user)
    const ok = await prisma.workOrder.findFirst({
      where: { AND: [{ id: workOrderId }, vis] },
      select: { id: true },
    })
    if (!ok) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const r = await runWorkOrderAdvance(user, workOrderId, parsed)
    if (!r.ok) {
      return NextResponse.json({ success: false, message: r.message }, { status: r.status })
    }

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
