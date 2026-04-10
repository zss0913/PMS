import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function endOfYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  const dt = new Date(y, mo - 1, d, 23, 59, 59, 999)
  return Number.isNaN(dt.getTime()) ? null : dt
}

async function resolveEffectiveTenantIds(userId: number, jwtRelations: { tenantId: number; buildingId: number }[] = []) {
  const tenantUser = await prisma.tenantUser.findUnique({
    where: { id: userId },
    select: {
      relations: {
        select: { tenantId: true, buildingId: true },
      },
    },
  })
  const dbRelations = tenantUser?.relations ?? []
  if (dbRelations.length === 0) {
    return []
  }
  if (jwtRelations.length === 0) {
    return Array.from(new Set(dbRelations.map((r) => r.tenantId)))
  }
  const scoped = dbRelations.filter((r) =>
    jwtRelations.some(
      (jr) => jr.tenantId === r.tenantId && jr.buildingId === r.buildingId
    )
  )
  const effective = scoped.length > 0 ? scoped : dbRelations
  return Array.from(new Set(effective.map((r) => r.tenantId)))
}

/** 租客端：获取当前租客的账单列表（仅租客管理员可看） */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user || user.type !== 'tenant') {
    return NextResponse.json(
      { success: false, message: '未登录或无权限' },
      { status: 401 }
    )
  }
  const tenantIds = await resolveEffectiveTenantIds(user.id, user.relations ?? [])
  if (tenantIds.length === 0) {
    return NextResponse.json({ success: true, list: [] })
  }

  const sp = request.nextUrl.searchParams
  const buildingId = sp.get('buildingId')
  const where: Record<string, unknown> = {
    tenantId: { in: tenantIds },
    companyId: user.companyId,
  }
  if (buildingId) {
    const n = parseInt(buildingId, 10)
    if (!Number.isNaN(n)) where.buildingId = n
  }

  const dueFrom = sp.get('dueDateFrom')?.trim()
  const dueTo = sp.get('dueDateTo')?.trim()
  const dueRange: { gte?: Date; lte?: Date } = {}
  if (dueFrom) {
    const d = parseYmdLocal(dueFrom)
    if (d) dueRange.gte = d
  }
  if (dueTo) {
    const d = endOfYmdLocal(dueTo)
    if (d) dueRange.lte = d
  }
  if (Object.keys(dueRange).length > 0) {
    where.dueDate = dueRange
  }

  const feeType = sp.get('feeType')?.trim()
  if (feeType) where.feeType = feeType

  /** 与列表展示一致：已缴=paid，其余为待缴 */
  const payState = sp.get('payState')?.trim()
  if (payState === 'paid') {
    where.paymentStatus = 'paid'
  } else if (payState === 'unpaid') {
    where.paymentStatus = { not: 'paid' }
  }

  const bills = await prisma.bill.findMany({
    where,
    include: {
      room: { select: { name: true, roomNumber: true } },
      tenant: { select: { companyName: true } },
    },
    orderBy: { dueDate: 'desc' },
  })

  const list = bills.map((b) => ({
    id: b.id,
    tenantId: b.tenantId,
    code: b.code,
    ruleName: b.ruleName,
    feeType: b.feeType,
    period: b.period,
    accountReceivable: Number(b.accountReceivable),
    amountPaid: Number(b.amountPaid),
    amountDue: Number(b.amountDue),
    status: b.status,
    paymentStatus: b.paymentStatus,
    dueDate: b.dueDate,
    room: formatBillRoomsDisplay(b.remark, b.room),
    tenantName: b.tenant?.companyName,
  }))

  return NextResponse.json({ success: true, list })
}
