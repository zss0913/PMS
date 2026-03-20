import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { buildBillWhereClause, filterBillsByPeriodOverlap } from '@/lib/bill-filters'
import {
  splitBillingPeriod,
  computeMonthlyNetRoom,
  computePeriodReceivableFromMonthly,
} from '@/lib/billing-period'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'
import { logBillActivity, BILL_ACTION, authUserForLog } from '@/lib/bill-activity-log'

const generateSchema = z.object({
  ruleId: z.number().int().min(1, '请选择账单规则'),
  items: z.array(z.object({
    tenantId: z.number().int().min(1),
    roomId: z.number().int().min(1),
  })).min(1, '请至少选择一个租客-房源'),
  dueDate: z.string().min(1, '应收日期必填'),
  remark: z.string().optional(),
  /** 可选：按「租客ID-楼宇ID」覆盖合并后的本单应收（须大于 0）；未传或缺省键则按规则试算 */
  groupAmounts: z.record(z.string(), z.number().positive()).optional(),
  /** 仅校验（含重复账单检测），不落库 */
  dryRun: z.boolean().optional(),
  /** 返回各合并组是否已有「开启」且费用类型/账期/应收日相同的账单（账单编号），不拦截、不落库 */
  intent: z.enum(['duplicate_map']).optional(),
})

const deleteBillsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, '请至少选择一条账单'),
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
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')
    const where = buildBillWhereClause(user.companyId, {
      buildingId: searchParams.get('buildingId'),
      tenantId: searchParams.get('tenantId'),
      tenantKeyword: searchParams.get('tenantKeyword'),
      status: searchParams.get('status'),
      paymentStatus: searchParams.get('paymentStatus'),
      overdue: searchParams.get('overdue'),
      feeType: searchParams.get('feeType'),
      feeTypeKeyword: searchParams.get('feeTypeKeyword'),
      dueDateStart: searchParams.get('dueDateStart'),
      dueDateEnd: searchParams.get('dueDateEnd'),
    })

    let bills = await prisma.bill.findMany({
      where,
      include: {
        tenant: { select: { id: true, companyName: true } },
        room: { select: { id: true, name: true, roomNumber: true, buildingId: true } },
        building: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
    })

    bills = filterBillsByPeriodOverlap(bills, periodStart, periodEnd)

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
      roomsDisplay: formatBillRoomsDisplay(b.remark, b.room),
      feeType: b.feeType,
      period: b.period,
      accountReceivable: Number(b.accountReceivable),
      amountPaid: Number(b.amountPaid),
      amountDue: Number(b.amountDue),
      receiptIssuedAmount: Number(b.receiptIssuedAmount ?? 0),
      invoiceIssuedAmount: Number(b.invoiceIssuedAmount ?? 0),
      status: b.status,
      paymentStatus: b.paymentStatus,
      dueDate: b.dueDate.toISOString().slice(0, 10),
      remark: b.remark,
      createdAt: b.createdAt.toISOString(),
      billSource: b.billSource,
      quantityTotal: b.quantityTotal != null ? Number(b.quantityTotal) : null,
      unitPrice: b.unitPrice != null ? Number(b.unitPrice) : null,
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
    const periodStartStr = rule.periodStartDate.toISOString().slice(0, 10)
    const periodEndStr = rule.periodEndDate.toISOString().slice(0, 10)
    const periodSplit = splitBillingPeriod(periodStartStr, periodEndStr)
    if (!periodSplit) {
      return NextResponse.json({ success: false, message: '账单规则账期起止无效' }, { status: 400 })
    }
    const amountPerSqm = Number(rule.amount)
    const discountRate = Number(rule.discountRate)
    const discountAmount = Number(rule.discountAmount)

    type TrRow = (typeof tenantRooms)[number]
    const resolved: { tenantId: number; roomId: number; tr: TrRow }[] = []
    for (const item of parsed.items) {
      const key = `${item.tenantId}-${item.roomId}`
      if (!validPairs.has(key)) {
        return NextResponse.json(
          { success: false, message: `租客-房源组合不存在: 租客${item.tenantId} 房源${item.roomId}` },
          { status: 400 }
        )
      }
      const tr = tenantRooms.find((t) => t.tenantId === item.tenantId && t.roomId === item.roomId)!
      resolved.push({ tenantId: item.tenantId, roomId: item.roomId, tr })
    }

    const seenPair = new Set<string>()
    const uniqueResolved = resolved.filter((x) => {
      const k = `${x.tenantId}-${x.roomId}`
      if (seenPair.has(k)) return false
      seenPair.add(k)
      return true
    })

    const groupMap = new Map<string, typeof uniqueResolved>()
    for (const x of uniqueResolved) {
      const bid = x.tr.room.buildingId
      const gk = `${x.tenantId}-${bid}`
      if (!groupMap.has(gk)) groupMap.set(gk, [])
      groupMap.get(gk)!.push(x)
    }

    const dueDayStr = parsed.dueDate.slice(0, 10)
    const dueStart = new Date(`${dueDayStr}T00:00:00.000Z`)
    const dueEnd = new Date(`${dueDayStr}T23:59:59.999Z`)

    type PendingBill = {
      lineItems: { tr: TrRow; receivable: number }[]
      totalReceivable: number
      mergedRemark: string | null
      groupKey: string
      primaryRoom: TrRow['room']
    }

    const pending: PendingBill[] = []

    for (const [, members] of groupMap) {
      const lineItems: { tr: TrRow; receivable: number }[] = []
      for (const x of members) {
        const tenant = x.tr.tenant
        const room = x.tr.room
        if (tenant.companyId !== user.companyId) {
          return NextResponse.json({ success: false, message: '租客不属于当前公司' }, { status: 400 })
        }
        if (ruleTenantIds.length > 0 && !ruleTenantIds.includes(tenant.id)) continue
        if (ruleBuildingIds.length > 0 && !ruleBuildingIds.includes(room.buildingId)) continue
        if (ruleRoomIds.length > 0 && !ruleRoomIds.includes(room.id)) continue

        const leaseArea = Number(x.tr.leaseArea) || 0
        const { monthlyNet } = computeMonthlyNetRoom(amountPerSqm, leaseArea, discountRate, discountAmount)
        const receivable = computePeriodReceivableFromMonthly(
          monthlyNet,
          periodSplit,
          periodStartStr,
          periodEndStr
        )
        lineItems.push({ tr: x.tr, receivable })
      }
      if (lineItems.length === 0) continue

      lineItems.sort((a, b) => a.tr.roomId - b.tr.roomId)
      const primaryRoom = lineItems[0].tr.room
      const groupKey = `${lineItems[0].tr.tenantId}-${primaryRoom.buildingId}`
      const overrideAmt = parsed.groupAmounts?.[groupKey]
      const computedTotal = lineItems.reduce((s, li) => s + li.receivable, 0)
      const totalReceivable =
        overrideAmt != null && typeof overrideAmt === 'number' && !Number.isNaN(overrideAmt)
          ? overrideAmt
          : computedTotal
      if (!(totalReceivable > 0)) {
        return NextResponse.json(
          { success: false, message: `本单应收须大于 0（租客·楼宇 ${groupKey}）` },
          { status: 400 }
        )
      }
      const roomNumbers = lineItems.map((li) => li.tr.room.roomNumber).join('、')
      const mergedRemark =
        lineItems.length > 1
          ? [parsed.remark?.trim(), `合并房源：${roomNumbers}`].filter(Boolean).join('\n')
          : parsed.remark?.trim() || null

      pending.push({ lineItems, totalReceivable, mergedRemark, groupKey, primaryRoom })
    }

    const duplicateByGroupKey: Record<string, string | null> = {}
    for (const p of pending) {
      const dup = await prisma.bill.findFirst({
        where: {
          companyId: user.companyId,
          tenantId: p.lineItems[0].tr.tenantId,
          buildingId: p.primaryRoom.buildingId,
          feeType: rule.feeType,
          period,
          status: 'open',
          dueDate: { gte: dueStart, lte: dueEnd },
        },
      })
      duplicateByGroupKey[p.groupKey] = dup?.code ?? null
    }

    if (parsed.intent === 'duplicate_map') {
      return NextResponse.json({
        success: true,
        data: { duplicateByGroupKey },
      })
    }

    const duplicateMessages: string[] = []
    for (const p of pending) {
      const code = duplicateByGroupKey[p.groupKey]
      if (code) {
        const tn = p.lineItems[0].tr.tenant.companyName
        const bn = p.primaryRoom.building.name
        duplicateMessages.push(
          `「${tn} / ${bn}」已存在开启状态的相同账单（费用类型、账期、应收日期一致），账单编号：${code}`
        )
      }
    }
    if (duplicateMessages.length > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'DUPLICATE_BILL',
          message: `${duplicateMessages.join('\n')}\n\n请勿重复生成。`,
        },
        { status: 400 }
      )
    }

    if (parsed.dryRun) {
      return NextResponse.json({
        success: true,
        data: { dryRun: true, count: pending.length },
      })
    }

    const created: { id: number; code: string }[] = []
    const existingBillCount = await prisma.bill.count({ where: { companyId: user.companyId } })
    let baseNum = existingBillCount + 1

    for (const p of pending) {
      const { lineItems, totalReceivable, mergedRemark, primaryRoom } = p

      let code = ''
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
          projectId: primaryRoom.building.projectId,
          buildingId: primaryRoom.buildingId,
          roomId: primaryRoom.id,
          tenantId: lineItems[0].tr.tenantId,
          feeType: rule.feeType,
          period,
          accountReceivable: new Decimal(totalReceivable),
          amountPaid: new Decimal(0),
          amountDue: new Decimal(totalReceivable),
          status: 'open',
          paymentStatus: 'unpaid',
          dueDate,
          accountId: rule.accountId,
          remark: mergedRemark,
          companyId: user.companyId,
        },
      })
      const op = authUserForLog(user)
      await logBillActivity(prisma, {
        billId: bill.id,
        billCode: bill.code,
        companyId: user.companyId,
        action: BILL_ACTION.CREATE,
        summary: '创建账单',
        operatorId: op.operatorId,
        operatorName: op.operatorName,
        operatorPhone: op.operatorPhone,
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

/** 批量物理删除账单（PaymentBill、Refund 等关联按库表级联删除） */
export async function DELETE(request: NextRequest) {
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

    const json = await request.json()
    const { ids } = deleteBillsSchema.parse(json)

    const toRemove = await prisma.bill.findMany({
      where: {
        id: { in: ids },
        companyId: user.companyId,
      },
      select: {
        id: true,
        code: true,
        feeType: true,
        period: true,
        accountReceivable: true,
      },
    })
    const op = authUserForLog(user)
    for (const b of toRemove) {
      await logBillActivity(prisma, {
        billId: b.id,
        billCode: b.code,
        companyId: user.companyId,
        action: BILL_ACTION.DELETE,
        summary: '删除账单',
        meta: {
          feeType: b.feeType,
          period: b.period,
          accountReceivable: Number(b.accountReceivable),
        },
        operatorId: op.operatorId,
        operatorName: op.operatorName,
        operatorPhone: op.operatorPhone,
      })
    }

    const result = await prisma.bill.deleteMany({
      where: {
        id: { in: ids },
        companyId: user.companyId,
      },
    })

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, message: '未找到可删除的账单（可能不属于当前公司或已删除）' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { deleted: result.count },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : '删除失败' },
      { status: 500 }
    )
  }
}
