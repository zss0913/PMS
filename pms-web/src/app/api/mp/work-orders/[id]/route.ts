import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseWorkOrderImageUrls } from '@/lib/work-order'

/** 租客端 / 员工端：工单详情（权限与列表一致） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getMpAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, message: '未登录' },
        { status: 401 }
      )
    }

    const { id } = await params
    const workOrderId = parseInt(id, 10)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ success: false, message: '无效的工单ID' }, { status: 400 })
    }

    const baseWhere: Record<string, unknown> = {
      id: workOrderId,
      companyId: user.companyId,
    }

    if (user.type === 'tenant') {
      const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
      if (tenantIds.length === 0) {
        return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
      }
      baseWhere.OR = [{ tenantId: { in: tenantIds } }, { reporterId: user.id }]
    } else {
      baseWhere.OR = [{ assignedTo: user.id }, { reporterId: user.id }]
    }

    const wo = await prisma.workOrder.findFirst({
      where: baseWhere,
      include: {
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        tenant: { select: { id: true, companyName: true } },
        assignedEmployee: { select: { id: true, name: true, phone: true } },
      },
    })

    if (!wo) {
      return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
    }

    const imageUrls = parseWorkOrderImageUrls(wo.images)

    return NextResponse.json({
      success: true,
      workOrder: {
        id: wo.id,
        code: wo.code,
        title: wo.title,
        type: wo.type,
        description: wo.description,
        status: wo.status,
        source: wo.source,
        facilityScope: wo.facilityScope,
        feeRemark: wo.feeRemark,
        feeNoticeAcknowledged: wo.feeNoticeAcknowledged,
        location: wo.location,
        images: wo.images,
        imageUrls,
        building: wo.building,
        room: wo.room,
        tenant: wo.tenant,
        assignedTo: wo.assignedTo,
        assignedEmployee: wo.assignedEmployee,
        createdAt: wo.createdAt.toISOString(),
        updatedAt: wo.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
