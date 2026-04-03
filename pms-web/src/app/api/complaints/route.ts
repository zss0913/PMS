import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { businessTagForComplaint } from '@/lib/staff-notification-routing'
import { writeStaffNotifications } from '@/lib/staff-notification-write'

const createSchema = z.object({
  buildingId: z.number(),
  tenantId: z.number(),
  location: z.string().min(1, '位置必填'),
  description: z.string().min(1, '投诉内容必填'),
})

export async function GET() {
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
    const complaints = await prisma.complaint.findMany({
      where: { companyId: user.companyId },
      include: {
        tenant: { select: { id: true, companyName: true } },
      },
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
      tenantId: c.tenantId,
      complainant: c.tenant?.companyName ?? '-',
      description: c.description,
      buildingId: c.buildingId,
      buildingName: buildingMap[c.buildingId] ?? '-',
      status: c.status,
      createdAt: c.createdAt,
    }))
    const tenants = await prisma.tenant.findMany({
      where: { companyId: user.companyId },
      select: { id: true, companyName: true },
    })
    const buildingsAll = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
    })
    return NextResponse.json({
      success: true,
      data: { list, tenants, buildings: buildingsAll },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const parsed = createSchema.parse(body)
    const complaint = await prisma.complaint.create({
      data: {
        buildingId: parsed.buildingId,
        tenantId: parsed.tenantId,
        reporterId: user.id,
        location: parsed.location,
        description: parsed.description,
        status: 'pending',
        companyId: user.companyId,
      },
    })
    const preview =
      parsed.description.length > 80
        ? `${parsed.description.slice(0, 80)}…`
        : parsed.description
    await writeStaffNotifications(prisma, {
      companyId: user.companyId,
      buildingId: parsed.buildingId,
      businessTag: businessTagForComplaint(),
      category: 'complaint',
      entityId: complaint.id,
      title: '新的卫生吐槽',
      summary: preview,
    })
    return NextResponse.json({ success: true, data: complaint })
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
