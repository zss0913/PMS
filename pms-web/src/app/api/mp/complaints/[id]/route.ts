import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeComplaintStatus } from '@/lib/complaint-status'
import { applyComplaintStaffAction, serializeComplaintImages, type ComplaintStaffActionBody } from '@/lib/complaint-process'
import { z } from 'zod'

const putSchema = z.object({
  status: z.string().optional(),
  assignedTo: z.number().int().positive().optional(),
  result: z.string().optional(),
  resultImages: z.array(z.string()).max(12).optional(),
})

async function loadComplaintPayload(companyId: number, complaintId: number) {
  const c = await prisma.complaint.findFirst({
    where: { id: complaintId, companyId },
    include: {
      tenant: { select: { companyName: true } },
    },
  })
  if (!c) return null

  const building = await prisma.building.findFirst({
    where: { id: c.buildingId, companyId },
    select: { name: true },
  })

  let assignedToName: string | null = null
  let handledByName: string | null = null
  const empIds = [c.assignedTo, c.handledBy].filter((x): x is number => x != null)
  if (empIds.length > 0) {
    const emps = await prisma.employee.findMany({
      where: { id: { in: [...new Set(empIds)] }, companyId },
      select: { id: true, name: true },
    })
    const m = Object.fromEntries(emps.map((e) => [e.id, e.name]))
    if (c.assignedTo) assignedToName = m[c.assignedTo] ?? null
    if (c.handledBy) handledByName = m[c.handledBy] ?? null
  }

  const tenantRoomRows = await prisma.tenantRoom.findMany({
    where: {
      tenantId: c.tenantId,
      room: {
        buildingId: c.buildingId,
        companyId,
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

  const activityLogs = await prisma.complaintActivityLog.findMany({
    where: { complaintId, companyId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      action: true,
      summary: true,
      operatorType: true,
      operatorName: true,
      createdAt: true,
    },
  })

  return {
    id: c.id,
    location: c.location,
    description: c.description,
    status: normalizeComplaintStatus(c.status),
    images: serializeComplaintImages(c.images),
    result: c.result,
    resultImages: serializeComplaintImages(c.resultImages),
    buildingName: building?.name ?? '-',
    tenantName: c.tenant?.companyName ?? '-',
    tenantRooms,
    createdAt: c.createdAt.toISOString(),
    handledAt: c.handledAt?.toISOString() ?? null,
    assignedTo: c.assignedTo,
    assignedToName,
    handledByName,
    activityLogs: activityLogs.map((log) => ({
      id: log.id,
      action: log.action,
      summary: log.summary,
      operatorType: log.operatorType,
      operatorName: log.operatorName,
      createdAt: log.createdAt.toISOString(),
    })),
  }
}

async function loadAssignees(companyId: number) {
  return prisma.employee.findMany({
    where: { companyId, status: 'active' },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
    take: 300,
  })
}

/** 租客查看自己的吐槽详情；员工查看本公司吐槽详情 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const { id } = await params
  const complaintId = parseInt(id, 10)
  if (Number.isNaN(complaintId)) {
    return NextResponse.json({ success: false, message: '无效的ID' }, { status: 400 })
  }

  const c = await prisma.complaint.findFirst({
    where: { id: complaintId, companyId: user.companyId },
  })
  if (!c) {
    return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
  }

  if (user.type === 'tenant') {
    if (c.reporterId !== user.id) {
      return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
    }
  } else if (user.type !== 'employee') {
    return NextResponse.json({ success: false, message: '无权限' }, { status: 403 })
  }

  const base = await loadComplaintPayload(user.companyId, complaintId)
  if (!base) {
    return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
  }

  if (user.type === 'employee') {
    const assignees = await loadAssignees(user.companyId)
    return NextResponse.json({
      success: true,
      data: { ...base, assignees, currentUserId: user.id },
    })
  }

  return NextResponse.json({ success: true, data: base })
}

/** 物业员工：受理（待处理→处理中+指派）、办结（处理中→已处理+结果/图片） */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '仅物业员工可处理' },
      { status: 403 }
    )
  }

  const { id } = await params
  const complaintId = parseInt(id, 10)
  if (Number.isNaN(complaintId)) {
    return NextResponse.json({ success: false, message: '无效的ID' }, { status: 400 })
  }

  let body: ComplaintStaffActionBody
  try {
    body = putSchema.parse(await request.json())
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

  const base = await loadComplaintPayload(user.companyId, complaintId)
  if (!base) {
    return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
  }
  const assignees = await loadAssignees(user.companyId)
  return NextResponse.json({
    success: true,
    data: { ...base, assignees, currentUserId: user.id },
  })
}
