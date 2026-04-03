import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { businessTagForComplaint } from '@/lib/staff-notification-routing'
import { writeStaffNotifications } from '@/lib/staff-notification-write'
import { normalizeComplaintStatus } from '@/lib/complaint-status'
import { serializeComplaintImages } from '@/lib/complaint-process'
import { z } from 'zod'

const postSchema = z.object({
  description: z.string().min(1, '请填写卫生吐槽说明'),
  images: z.array(z.string()).max(12).optional(),
  /** 多租客关联时指定当前要提交的 tenantId */
  tenantId: z.number().int().positive().optional(),
})

function pickTenantRelation(
  user: NonNullable<Awaited<ReturnType<typeof getMpAuthUser>>>,
  tenantId?: number
) {
  const rels = user.relations ?? []
  if (rels.length === 0) return null
  if (tenantId != null) {
    return rels.find((r) => r.tenantId === tenantId) ?? null
  }
  return rels[0] ?? null
}

/** 租客端：我的卫生吐槽列表 */
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
    return NextResponse.json({ success: true, data: { list: [] } })
  }

  const complaints = await prisma.complaint.findMany({
    where: {
      tenantId: { in: tenantIds },
      companyId: user.companyId,
      reporterId: user.id,
    },
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
    status: normalizeComplaintStatus(c.status),
    images: serializeComplaintImages(c.images),
    buildingName: buildingMap[c.buildingId] ?? '-',
    tenantName: c.tenant?.companyName,
    createdAt: c.createdAt.toISOString(),
  }))

  return NextResponse.json({ success: true, data: { list } })
}

/** 租客端：提交卫生吐槽（自动带出当前租客、楼宇；仅租客账号） */
export async function POST(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json(
      { success: false, message: '仅租客账号可提交卫生吐槽' },
      { status: 403 }
    )
  }

  let body: z.infer<typeof postSchema>
  try {
    body = postSchema.parse(await request.json())
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误' },
        { status: 400 }
      )
    }
    return NextResponse.json({ success: false, message: '参数错误' }, { status: 400 })
  }

  const rel = pickTenantRelation(user, body.tenantId)
  if (!rel) {
    return NextResponse.json(
      { success: false, message: '请先关联租客，或选择有效的租客主体' },
      { status: 400 }
    )
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: rel.tenantId, companyId: user.companyId },
  })
  if (!tenant) {
    return NextResponse.json({ success: false, message: '租客数据不存在' }, { status: 400 })
  }

  if (tenant.buildingId !== rel.buildingId) {
    return NextResponse.json({ success: false, message: '租客与楼宇信息不一致' }, { status: 400 })
  }

  const buildingId = tenant.buildingId
  const imagesJson =
    body.images && body.images.length > 0 ? JSON.stringify(body.images) : null

  const building = await prisma.building.findFirst({
    where: { id: buildingId, companyId: user.companyId },
    select: { name: true },
  })

  const complaint = await prisma.complaint.create({
    data: {
      buildingId,
      tenantId: tenant.id,
      reporterId: user.id,
      location: building?.name ? `所属楼宇：${building.name}` : '',
      description: body.description.trim(),
      images: imagesJson,
      status: '待处理',
      companyId: user.companyId,
    },
  })

  const preview =
    complaint.description.length > 80
      ? `${complaint.description.slice(0, 80)}…`
      : complaint.description
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
    data: { id: complaint.id },
  })
}
