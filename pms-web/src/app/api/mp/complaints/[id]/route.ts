import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 员工端：卫生吐槽详情 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'employee') {
    return NextResponse.json(
      { success: false, message: '未登录或非员工' },
      { status: 401 }
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
    },
  })

  if (!c) {
    return NextResponse.json({ success: false, message: '记录不存在' }, { status: 404 })
  }

  const building = await prisma.building.findFirst({
    where: { id: c.buildingId, companyId: user.companyId },
    select: { name: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      id: c.id,
      location: c.location,
      description: c.description,
      status: c.status,
      buildingName: building?.name ?? '-',
      tenantName: c.tenant?.companyName ?? '-',
      createdAt: c.createdAt.toISOString(),
      result: c.result,
      handledAt: c.handledAt?.toISOString() ?? null,
    },
  })
}
