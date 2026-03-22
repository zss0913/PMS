import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'
import { mpEmployeeWorkOrderVisibilityWhere } from '@/lib/mp-employee-work-order-scope'
const tenantSubmitSchema = z.object({
  category: z.enum(['报事', '报修']),
  facilityScope: z.enum(['公共设施', '套内设施']),
  title: z.string().min(1, '请填写标题'),
  description: z.string().min(1, '请填写问题描述'),
  location: z.string().optional(),
  images: z.array(z.string()).max(9).optional(),
  feeNoticeAcknowledged: z.boolean().optional(),
})

function genWorkOrderCode() {
  return 'WO' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
}

/** 租客端 / 员工端：工单列表 */
export async function GET(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, message: '未登录' },
        { status: 401 }
      )
    }

    const status = request.nextUrl.searchParams.get('status')

    let whereInput: Prisma.WorkOrderWhereInput
    if (user.type === 'tenant') {
      const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
      if (tenantIds.length === 0) {
        return NextResponse.json({ success: true, list: [] })
      }
      whereInput = {
        companyId: user.companyId,
        OR: [{ tenantId: { in: tenantIds } }, { reporterId: user.id }],
        ...(status ? { status } : {}),
      }
    } else {
      whereInput = {
        ...mpEmployeeWorkOrderVisibilityWhere(user),
        ...(status ? { status } : {}),
      }
    }

    const orders = await prisma.workOrder.findMany({
      where: whereInput,
      include: {
        building: { select: { name: true } },
        room: { select: { name: true, roomNumber: true } },
        tenant: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const list = orders.map((o) => ({
      id: o.id,
      code: o.code,
      title: o.title,
      type: o.type,
      description: o.description,
      status: o.status,
      source: o.source,
      facilityScope: o.facilityScope,
      feeRemark: o.feeRemark,
      buildingName: o.building?.name,
      room: o.room ? `${o.room.roomNumber} · ${o.room.name}` : null,
      tenantName: o.tenant?.companyName,
      createdAt: o.createdAt.toISOString(),
    }))

    return NextResponse.json({ success: true, list })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

/** 租客端：报事报修（楼宇/房源/租客由账号自动带出） */
export async function POST(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json(
        { success: false, message: '未登录或无权限' },
        { status: 401 }
      )
    }

    const rel = user.relations?.[0]
    if (!rel) {
      return NextResponse.json(
        { success: false, message: '请先关联租客后再报事报修' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = tenantSubmitSchema.parse(body)

    if (parsed.facilityScope === '套内设施' && !parsed.feeNoticeAcknowledged) {
      return NextResponse.json(
        {
          success: false,
          message: '套内设施报修可能产生费用，请阅读说明并勾选确认后再提交',
        },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: rel.tenantId, companyId: user.companyId },
    })
    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客数据不存在' }, { status: 400 })
    }

    const firstLink = await prisma.tenantRoom.findFirst({
      where: { tenantId: rel.tenantId },
      orderBy: { id: 'asc' },
    })

    const buildingId = tenant.buildingId
    const roomId = firstLink?.roomId ?? null
    const tenantId = tenant.id

    let code = genWorkOrderCode()
    while (await prisma.workOrder.findUnique({ where: { code } })) {
      code = genWorkOrderCode()
    }

    const imagesJson =
      parsed.images && parsed.images.length > 0 ? JSON.stringify(parsed.images) : null

    const workOrder = await prisma.workOrder.create({
      data: {
        code,
        building: { connect: { id: buildingId } },
        ...(roomId != null ? { room: { connect: { id: roomId } } } : {}),
        tenant: { connect: { id: tenantId } },
        reporterId: user.id,
        source: '租客自建',
        type: parsed.category,
        title: parsed.title.trim(),
        description: parsed.description.trim(),
        location: parsed.location?.trim() || null,
        images: imagesJson,
        status: '待派单',
        company: { connect: { id: user.companyId } },
        facilityScope: parsed.facilityScope,
        feeNoticeAcknowledged: parsed.facilityScope === '套内设施' ? Boolean(parsed.feeNoticeAcknowledged) : false,
      },
    })

    await logWorkOrderActivity(prisma, {
      workOrderId: workOrder.id,
      workOrderCode: workOrder.code,
      companyId: user.companyId,
      action: WORK_ORDER_ACTION.CREATE,
      summary: `租客端创建工单「${workOrder.title}」（${workOrder.type}）`,
      ...operatorFromAuthUser(user),
    })

    return NextResponse.json({
      success: true,
      id: workOrder.id,
      code: workOrder.code,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误' },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
