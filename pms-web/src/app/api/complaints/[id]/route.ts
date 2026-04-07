import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import {
  applyComplaintStaffAction,
  type ComplaintStaffActionBody,
} from '@/lib/complaint-process'
import { normalizeComplaintStatus } from '@/lib/complaint-status'
import { serializeComplaintImages } from '@/lib/complaint-process'
import { buildComplaintFallbackTimeline } from '@/lib/complaint-detail-timeline'

const updateSchema = z.object({
  status: z.string().optional(),
  assignedTo: z.number().int().positive().optional(),
  result: z.string().optional(),
  resultImages: z.array(z.string()).max(12).optional(),
})

/** PC：卫生吐槽详情（正文、图片、操作时间线） */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0 || user.type !== 'employee') {
      return NextResponse.json(
        { success: false, message: '请使用物业公司员工账号查看' },
        { status: 403 }
      )
    }
    const { id } = await params
    const complaintId = parseInt(id, 10)
    if (Number.isNaN(complaintId)) {
      return NextResponse.json({ success: false, message: '无效的ID' }, { status: 400 })
    }

    const c = await prisma.complaint.findFirst({
      where: { id: complaintId, companyId: user.companyId },
      include: {
        tenant: { select: { companyName: true } },
        activityLogs: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!c) {
      return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
    }

    const building = await prisma.building.findFirst({
      where: { id: c.buildingId, companyId: user.companyId },
      select: { name: true },
    })
    const reporter = await prisma.tenantUser.findUnique({
      where: { id: c.reporterId },
      select: { id: true, name: true, phone: true },
    })

    const empIds = [c.assignedTo, c.handledBy].filter((x): x is number => x != null)
    const emps =
      empIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: empIds }, companyId: user.companyId },
            select: { id: true, name: true },
          })
        : []
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e.name]))

    /** 租客主体在本楼宇下已关联的房间（楼层 + 房间号），供物业定位 */
    const tenantRoomRows = await prisma.tenantRoom.findMany({
      where: {
        tenantId: c.tenantId,
        room: {
          buildingId: c.buildingId,
          companyId: user.companyId,
        },
      },
      include: {
        room: {
          select: {
            name: true,
            roomNumber: true,
            floor: { select: { name: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    })
    const tenantRooms = tenantRoomRows.map((tr) => ({
      floorName: tr.room.floor.name,
      roomNumber: tr.room.roomNumber,
      roomName: tr.room.name,
    }))

    const timeline =
      c.activityLogs.length > 0
        ? c.activityLogs.map((log) => ({
            id: log.id,
            action: log.action,
            summary: log.summary,
            operatorType: log.operatorType,
            operatorName: log.operatorName,
            operatorId: log.operatorId,
            createdAt: log.createdAt.toISOString(),
            synthetic: false as const,
          }))
        : buildComplaintFallbackTimeline(c, {
            reporterName: reporter?.name ?? '租客用户',
            reporterPhone: reporter?.phone ?? undefined,
            assigneeName: c.assignedTo ? empMap[c.assignedTo] ?? null : null,
            handlerName: c.handledBy ? empMap[c.handledBy] ?? null : null,
          }).map((t) => ({
            ...t,
            synthetic: true as const,
          }))

    return NextResponse.json({
      success: true,
      data: {
        id: c.id,
        code: 'C' + String(c.id).padStart(5, '0'),
        status: normalizeComplaintStatus(c.status),
        location: c.location,
        description: c.description,
        images: serializeComplaintImages(c.images),
        result: c.result,
        resultImages: serializeComplaintImages(c.resultImages),
        buildingName: building?.name ?? '-',
        tenantName: c.tenant?.companyName ?? '-',
        /** 同一吐槽所属楼宇下，该租客已绑定的房间列表 */
        tenantRooms,
        reporter: reporter
          ? { id: reporter.id, name: reporter.name, phone: reporter.phone }
          : { id: c.reporterId, name: '-', phone: '' },
        assignedTo: c.assignedTo,
        assignedToName: c.assignedTo ? empMap[c.assignedTo] ?? null : null,
        handledBy: c.handledBy,
        handledByName: c.handledBy ? empMap[c.handledBy] ?? null : null,
        handledAt: c.handledAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        timeline,
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
    if (user.companyId === 0 || user.type !== 'employee') {
      return NextResponse.json(
        { success: false, message: '请使用物业公司员工账号操作' },
        { status: 403 }
      )
    }
    const { id } = await params
    const complaintId = parseInt(id, 10)
    if (Number.isNaN(complaintId)) {
      return NextResponse.json({ success: false, message: '无效的投诉ID' }, { status: 400 })
    }

    let body: ComplaintStaffActionBody
    try {
      body = updateSchema.parse(await request.json())
    } catch {
      return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
    }

    const r = await applyComplaintStaffAction(prisma, {
      complaintId,
      companyId: user.companyId,
      actorEmployeeId: user.id,
      body,
    })

    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.message },
        { status: r.status ?? 400 }
      )
    }

    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId, companyId: user.companyId },
    })
    return NextResponse.json({ success: true, data: complaint })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
