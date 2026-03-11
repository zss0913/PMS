import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const generateSchema = z.object({
  ruleId: z.number().int().min(1, '请选择账单规则'),
  items: z.array(z.object({
    tenantId: z.number().int().min(1),
    roomId: z.number().int().min(1),
  })).min(1, '请至少选择一个租客-房源'),
  dueDate: z.string().min(1, '应收日期必填'),
  remark: z.string().optional(),
})

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const buildingId = searchParams.get('buildingId')
    const tenantId = searchParams.get('tenantId')
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('paymentStatus')
    const overdue = searchParams.get('overdue')

    const where: Record<string, unknown> = { companyId: user.companyId }
    if (buildingId) {
      const bid = parseInt(buildingId, 10)
      if (!isNaN(bid)) where.buildingId = bid
    }
    if (tenantId) {
      const tid = parseInt(tenantId, 10)
      if (!isNaN(tid)) where.tenantId = tid
    }
    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus
    if (overdue === 'true') {
      where.dueDate = { lt: new Date() }
      where.paymentStatus = { not: 'paid' }
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        tenant: { select: { id: true, companyName: true } },
        room: { select: { id: true, name: true, roomNumber: true, buildingId: true } },
        building: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
    })

    const buildings = await prisma.building.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const tenants = await prisma.tenant.findMany({
      where: { companyId: user.companyId },
      select: { id: true, companyName: true },
      orderBy: { id: 'asc' },
    })

    const list = bills.map((b) => ({
      id: b.id,
      code: b.code,
      tenant: b.tenant,
      building: b.building,
      room: b.room,
      feeType: b.feeType,
      period: b.period,
      accountReceivable: Number(b.accountReceivable),
      amountPaid: Number(b.amountPaid),
      amountDue: Number(b.amountDue),
      status: b.status,
      paymentStatus: b.paymentStatus,
      dueDate: b.dueDate.toISOString().slice(0, 10),
      remark: b.remark,
      createdAt: b.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { list, buildings, tenants },
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
    const parsed = generateSchema.parse(body)

    const rule = await prisma.billRule.findFirst({
      where: { id: parsed.ruleId, companyId: user.companyId, status: 'active' },
      include: { account: true },
    })
    if (!rule) {
      return NextResponse.json({ success: false, message: '账单规则不存在或已停用' }, { status: 400 })
    }

    const roomIds = parsed.items.map((i) => i.roomId)
    const tenantRooms = await prisma.tenantRoom.findMany({
      where: {
        OR: parsed.items.map((i) => ({ tenantId: i.tenantId, roomId: i.roomId })),
      },
      include: {
        tenant: true,
        room: { include: { building: true } },
      },
    })

    const validPairs = new Set(tenantRooms.map((tr) => `${tr.tenantId}-${tr.roomId}`))
    const ruleTenantIds = parseJsonIds(rule.tenantIds)
    const ruleBuildingIds = parseJsonIds(rule.buildingIds)
    const ruleRoomIds = parseJsonIds(rule.roomIds)

    const dueDate = new Date(parsed.dueDate)
    const period = `${rule.periodStartDate.toISOString().slice(0, 10)} ~ ${rule.periodEndDate.toISOString().slice(0, 10)}`

    const amount = Number(rule.amount) * (1 - Number(rule.discountRate)) - Number(rule.discountAmount)
    const receivable = Math.max(0, amount)

    const created: { id: number; code: string }[] = []
    const count = await prisma.bill.count({ where: { companyId: user.companyId } })
    let baseNum = count + 1

    for (const item of parsed.items) {
      const key = `${item.tenantId}-${item.roomId}`
      if (!validPairs.has(key)) {
        return NextResponse.json(
          { success: false, message: `租客-房源组合不存在: 租客${item.tenantId} 房源${item.roomId}` },
          { status: 400 }
        )
      }

      const tr = tenantRooms.find((t) => t.tenantId === item.tenantId && t.roomId === item.roomId)!
      const room = tr.room
      const tenant = tr.tenant

      if (tenant.companyId !== user.companyId) {
        return NextResponse.json({ success: false, message: '租客不属于当前公司' }, { status: 400 })
      }

      if (ruleTenantIds.length > 0 && !ruleTenantIds.includes(tenant.id)) continue
      if (ruleBuildingIds.length > 0 && !ruleBuildingIds.includes(room.buildingId)) continue
      if (ruleRoomIds.length > 0 && !ruleRoomIds.includes(room.id)) continue

      let code: string
      let exists = true
      while (exists) {
        code = `BILL${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(baseNum).padStart(4, '0')}`
        const existsBill = await prisma.bill.findUnique({ where: { code } })
        exists = !!existsBill
        if (exists) baseNum++
      }

      const bill = await prisma.bill.create({
        data: {
          code,
          ruleId: rule.id,
          ruleName: rule.name,
          projectId: room.building.projectId,
          buildingId: room.buildingId,
          roomId: room.id,
          tenantId: tenant.id,
          feeType: rule.feeType,
          period,
          accountReceivable: new Decimal(receivable),
          amountPaid: new Decimal(0),
          amountDue: new Decimal(receivable),
          status: 'open',
          paymentStatus: 'unpaid',
          dueDate,
          accountId: rule.accountId,
          remark: parsed.remark ?? null,
          companyId: user.companyId,
        },
      })
      created.push({ id: bill.id, code: bill.code })
    }

    return NextResponse.json({
      success: true,
      data: { created, count: created.length },
    })
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
