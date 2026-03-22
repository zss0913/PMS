import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseWorkOrderImageUrls } from '@/lib/work-order'
import { mpEmployeeWorkOrderVisibilityWhere } from '@/lib/mp-employee-work-order-scope'

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

    let where: Prisma.WorkOrderWhereInput

    if (user.type === 'tenant') {
      const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
      if (tenantIds.length === 0) {
        return NextResponse.json({ success: false, message: '工单不存在' }, { status: 404 })
      }
      where = {
        id: workOrderId,
        companyId: user.companyId,
        OR: [{ tenantId: { in: tenantIds } }, { reporterId: user.id }],
      }
    } else {
      const vis = mpEmployeeWorkOrderVisibilityWhere(user)
      where = {
        AND: [{ id: workOrderId }, vis],
      }
    }

    const wo = await prisma.workOrder.findFirst({
      where,
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

    const reporterEmployee = await prisma.employee.findFirst({
      where: { id: wo.reporterId, companyId: wo.companyId },
      select: { name: true, phone: true },
    })
    const reporterTenant = reporterEmployee
      ? null
      : await prisma.tenantUser.findFirst({
          where: { id: wo.reporterId, companyId: wo.companyId },
          select: { name: true, phone: true },
        })
    const reporter = reporterEmployee
      ? { role: '员工' as const, name: reporterEmployee.name, phone: reporterEmployee.phone }
      : reporterTenant
        ? { role: '租客' as const, name: reporterTenant.name, phone: reporterTenant.phone }
        : null

    const iso = (d: Date | null) => (d ? d.toISOString() : null)

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
        severity: wo.severity,
        projectId: wo.projectId,
        taskId: wo.taskId,
        tagId: wo.tagId,
        images: wo.images,
        imageUrls,
        building: wo.building,
        room: wo.room,
        tenant: wo.tenant,
        reporterId: wo.reporterId,
        reporter,
        assignedTo: wo.assignedTo,
        assignedEmployee: wo.assignedEmployee,
        assignedAt: iso(wo.assignedAt),
        respondedAt: iso(wo.respondedAt),
        feeConfirmedAt: iso(wo.feeConfirmedAt),
        completedAt: iso(wo.completedAt),
        evaluatedAt: iso(wo.evaluatedAt),
        createdAt: wo.createdAt.toISOString(),
        updatedAt: wo.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
