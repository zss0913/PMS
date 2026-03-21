import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

const bodySchema = z.object({
  action: z.enum([
    'start_processing',
    'request_fee_confirmation',
    'complete_for_evaluation',
    'mark_evaluated',
    'cancel',
  ]),
  feeRemark: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'employee' || user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '仅物业员工可操作' },
        { status: 403 }
      )
    }

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const wo = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: user.companyId },
    })
    if (!wo) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = bodySchema.parse(body)

    const now = new Date()
    const op = operatorFromAuthUser(user)

    switch (parsed.action) {
      case 'start_processing': {
        if (wo.status !== '待响应') {
          return NextResponse.json(
            { success: false, message: '仅「待响应」的工单可开始处理' },
            { status: 400 }
          )
        }
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: { status: '处理中', respondedAt: wo.respondedAt ?? now },
        })
        await logWorkOrderActivity(prisma, {
          workOrderId,
          workOrderCode: wo.code,
          companyId: user.companyId,
          action: WORK_ORDER_ACTION.START_PROCESSING,
          summary: '待响应 → 处理中（开始处理）',
          ...op,
        })
        break
      }
      case 'request_fee_confirmation': {
        if (wo.status !== '处理中') {
          return NextResponse.json(
            { success: false, message: '仅「处理中」的工单可提交费用待确认' },
            { status: 400 }
          )
        }
        const remark = parsed.feeRemark?.trim() || null
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: {
            status: '待确认费用',
            feeRemark: remark,
          },
        })
        await logWorkOrderActivity(prisma, {
          workOrderId,
          workOrderCode: wo.code,
          companyId: user.companyId,
          action: WORK_ORDER_ACTION.REQUEST_FEE_CONFIRMATION,
          summary: remark
            ? `处理中 → 待确认费用；费用说明：${remark.slice(0, 120)}${remark.length > 120 ? '…' : ''}`
            : '处理中 → 待确认费用',
          meta: { feeRemark: remark },
          ...op,
        })
        break
      }
      case 'complete_for_evaluation': {
        if (wo.status !== '处理中') {
          return NextResponse.json(
            { success: false, message: '仅「处理中」的工单可办结并进入待评价' },
            { status: 400 }
          )
        }
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: { status: '待评价', completedAt: now },
        })
        await logWorkOrderActivity(prisma, {
          workOrderId,
          workOrderCode: wo.code,
          companyId: user.companyId,
          action: WORK_ORDER_ACTION.COMPLETE_FOR_EVALUATION,
          summary: '处理中 → 待评价（办结）',
          ...op,
        })
        break
      }
      case 'mark_evaluated': {
        if (wo.status !== '待评价') {
          return NextResponse.json(
            { success: false, message: '仅「待评价」的工单可标记为评价完成' },
            { status: 400 }
          )
        }
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: { status: '评价完成', evaluatedAt: now },
        })
        await logWorkOrderActivity(prisma, {
          workOrderId,
          workOrderCode: wo.code,
          companyId: user.companyId,
          action: WORK_ORDER_ACTION.MARK_EVALUATED,
          summary: '待评价 → 评价完成',
          ...op,
        })
        break
      }
      case 'cancel': {
        if (!['待派单', '待响应', '处理中'].includes(wo.status)) {
          return NextResponse.json(
            { success: false, message: '当前状态不可取消' },
            { status: 400 }
          )
        }
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: { status: '已取消' },
        })
        await logWorkOrderActivity(prisma, {
          workOrderId,
          workOrderCode: wo.code,
          companyId: user.companyId,
          action: WORK_ORDER_ACTION.CANCEL,
          summary: `${wo.status} → 已取消`,
          ...op,
        })
        break
      }
      default:
        return NextResponse.json({ success: false, message: '未知操作' }, { status: 400 })
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
