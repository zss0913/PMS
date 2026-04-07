import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { normalizeComplaintStatus } from '@/lib/complaint-status'
import { serializeComplaintImages } from '@/lib/complaint-process'

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
    const complaintBuildings =
      buildingIds.length > 0
        ? await prisma.building.findMany({
            where: { id: { in: buildingIds } },
            select: { id: true, name: true },
          })
        : []
    const buildingMap = Object.fromEntries(complaintBuildings.map((b) => [b.id, b.name]))

    const empIds = new Set<number>()
    complaints.forEach((c) => {
      if (c.assignedTo) empIds.add(c.assignedTo)
      if (c.handledBy) empIds.add(c.handledBy)
    })
    const emps =
      empIds.size > 0
        ? await prisma.employee.findMany({
            where: { id: { in: [...empIds] }, companyId: user.companyId },
            select: { id: true, name: true },
          })
        : []
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e.name]))

    const list = complaints.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      complainant: c.tenant?.companyName ?? '-',
      description: c.description,
      buildingId: c.buildingId,
      buildingName: buildingMap[c.buildingId] ?? '-',
      status: normalizeComplaintStatus(c.status),
      images: serializeComplaintImages(c.images),
      assignedTo: c.assignedTo,
      assignedToName: c.assignedTo ? empMap[c.assignedTo] ?? '-' : null,
      handledByName: c.handledBy ? empMap[c.handledBy] ?? '-' : null,
      result: c.result,
      createdAt: c.createdAt.toISOString(),
    }))

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: { list, employees, buildings, currentUserId: user.id },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

/** 卫生吐槽仅允许租客端提交，PC 不再代客新增 */
export async function POST(_request: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }
  return NextResponse.json(
    {
      success: false,
      message: '卫生吐槽请由租客在租客端提交，后台不支持代填',
    },
    { status: 403 }
  )
}
