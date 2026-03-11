import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 租客端：获取我的工单列表 */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { success: false, message: '未登录' },
      { status: 401 }
    )
  }

  const status = request.nextUrl.searchParams.get('status')
  const where: Record<string, unknown> = { companyId: user.companyId }

  if (user.type === 'tenant') {
    const tenantIds = user.relations?.map((r) => r.tenantId) ?? []
    if (tenantIds.length === 0) {
      return NextResponse.json({ success: true, list: [] })
    }
    where.tenantId = { in: tenantIds }
  } else {
    where.OR = [
      { assignedTo: user.id },
      { reporterId: user.id },
    ]
  }

  if (status) where.status = status

  const orders = await prisma.workOrder.findMany({
    where,
    include: {
      room: { select: { name: true, roomNumber: true } },
      tenant: { select: { companyName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const list = orders.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    type: o.type,
    description: o.description,
    status: o.status,
    room: o.room?.name || o.room?.roomNumber,
    tenantName: o.tenant?.companyName,
    createdAt: o.createdAt,
  }))

  return NextResponse.json({ success: true, list })
}

/** 租客端：提交报事报修 */
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
  const { tenantId, buildingId, roomId, type, title, description, location } = body

  if (!tenantId || !buildingId || !roomId || !type || !title || !description) {
    return NextResponse.json(
      { success: false, message: '缺少必填参数' },
      { status: 400 }
    )
  }

  if (!tenantIds.includes(tenantId)) {
    return NextResponse.json(
      { success: false, message: '无权限为该租客提交' },
      { status: 403 }
    )
  }

  const code = 'WO' + Date.now().toString(36).toUpperCase()
  const workOrder = await prisma.workOrder.create({
    data: {
      code,
      buildingId,
      roomId,
      tenantId,
      reporterId: user.id,
      source: '租客端' as string,
      type,
      title,
      description: description || '',
      location: location || null,
      status: 'pending',
      companyId: user.companyId,
    },
  })

  return NextResponse.json({
    success: true,
    id: workOrder.id,
    code: workOrder.code,
  })
}
