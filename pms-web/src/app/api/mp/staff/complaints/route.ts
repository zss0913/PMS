import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeComplaintStatus } from '@/lib/complaint-status'
import { serializeComplaintImages } from '@/lib/complaint-process'

function parseStatusTab(raw: string | null): 'all' | 'pending' | 'processing' | 'completed' {
  const s = (raw || 'all').trim().toLowerCase()
  if (s === 'pending' || s === '待处理') return 'pending'
  if (s === 'processing' || s === '处理中') return 'processing'
  if (s === 'completed' || s === '已处理') return 'completed'
  return 'all'
}

function statusWhereForTab(
  tab: 'all' | 'pending' | 'processing' | 'completed'
): { status?: { in: string[] } } {
  if (tab === 'all') return {}
  if (tab === 'pending') {
    return { status: { in: ['待处理', 'pending'] } }
  }
  if (tab === 'processing') {
    return { status: { in: ['处理中', 'processing'] } }
  }
  return { status: { in: ['已处理', 'completed'] } }
}

/** 员工端：本公司卫生吐槽列表（与 PC 状态 Tab 一致） */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
    )
  }

  const companyId = user.companyId
  const tab = parseStatusTab(request.nextUrl.searchParams.get('statusTab'))
  const statusFilter = statusWhereForTab(tab)
  const baseWhere = { companyId }
  const where = { ...baseWhere, ...statusFilter }

  const [complaints, countRows] = await Promise.all([
    prisma.complaint.findMany({
      where,
      include: { tenant: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.complaint.findMany({
      where: baseWhere,
      select: { status: true },
    }),
  ])

  let pending = 0
  let processing = 0
  let completed = 0
  for (const r of countRows) {
    const n = normalizeComplaintStatus(r.status)
    if (n === '待处理') pending += 1
    else if (n === '处理中') processing += 1
    else if (n === '已处理') completed += 1
  }
  const all = countRows.length

  const buildingIds = [...new Set(complaints.map((c) => c.buildingId))]
  const buildings =
    buildingIds.length > 0
      ? await prisma.building.findMany({
          where: { id: { in: buildingIds }, companyId },
          select: { id: true, name: true },
        })
      : []
  const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]))

  const empIds = [
    ...new Set(complaints.map((c) => c.assignedTo).filter((x): x is number => x != null)),
  ]
  const emps =
    empIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: empIds }, companyId },
          select: { id: true, name: true },
        })
      : []
  const empMap = Object.fromEntries(emps.map((e) => [e.id, e.name]))

  const list = complaints.map((c) => ({
    id: c.id,
    code: 'C' + String(c.id).padStart(5, '0'),
    location: c.location,
    description: c.description,
    status: normalizeComplaintStatus(c.status),
    images: serializeComplaintImages(c.images),
    buildingName: buildingMap[c.buildingId] ?? '-',
    tenantName: c.tenant?.companyName ?? '-',
    assignedTo: c.assignedTo,
    assignedToName: c.assignedTo ? empMap[c.assignedTo] ?? null : null,
    createdAt: c.createdAt.toISOString(),
  }))

  return NextResponse.json({
    success: true,
    data: {
      list,
      counts: {
        all,
        pending,
        processing,
        completed,
      },
    },
  })
}
