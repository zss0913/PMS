import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { businessTagForComplaint } from '@/lib/staff-notification-routing'
import { writeStaffNotifications } from '@/lib/staff-notification-write'

/** 租客端：获取我的吐槽列表 */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json(
      { success: false, message: '未登录或无权限' },
      { status: 401 }
    )
  }

  const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
  if (tenantIds.length === 0) {
    return NextResponse.json({ success: true, list: [] })
  }

  const complaints = await prisma.complaint.findMany({
    where: { tenantId: { in: tenantIds }, companyId: user.companyId },
    include: { tenant: { select: { companyName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const buildingIds = [...new Set(complaints.map((c) => c.buildingId))]
  const buildings =
    buildingIds.length > 0
      ? await prisma.building.findMany({
          where: { id: { in: buildingIds } },
          select: { id: true, name: true },
        })
      : []
  const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]))

  const list = complaints.map((c) => ({
    id: c.id,
    location: c.location,
    description: c.description,
    status: c.status,
    buildingName: buildingMap[c.buildingId] ?? '-',
    tenantName: c.tenant?.companyName,
    createdAt: c.createdAt,
  }))

  return NextResponse.json({ success: true, list })
}

/** 租客端：提交卫生吐槽 */
export async function POST(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json(
      { success: false, message: '未登录或无权限' },
      { status: 401 }
    )
  }

  const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
  if (tenantIds.length === 0) {
    return NextResponse.json(
      { success: false, message: '请先关联租客' },
      { status: 400 }
    )
  }

  const body = await request.json()
  const { tenantId, buildingId, location, description } = body

  if (!tenantId || !buildingId || !description) {
    return NextResponse.json(
      { success: false, message: '缺少必填参数' },
      { status: 400 }
    )
  }

  if (!tenantIds.includes(tenantId)) {
    return NextResponse.json(
      { success: false, message: '无权限' },
      { status: 403 }
    )
  }

  const complaint = await prisma.complaint.create({
    data: {
      buildingId,
      tenantId,
      reporterId: user.id,
      location: location || '',
      description,
      status: 'pending',
      companyId: user.companyId,
    },
  })

  const preview =
    description.length > 80 ? `${description.slice(0, 80)}…` : description
  await writeStaffNotifications(prisma, {
    companyId: user.companyId,
    buildingId,
    businessTag: businessTagForComplaint(),
    category: 'complaint',
    entityId: complaint.id,
    title: '新的卫生吐槽',
    summary: preview,
  })

  return NextResponse.json({
    success: true,
    id: complaint.id,
  })
}
