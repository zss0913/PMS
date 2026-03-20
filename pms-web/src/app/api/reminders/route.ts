import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { logBillActivity, BILL_ACTION, authUserForLog } from '@/lib/bill-activity-log'
import { allocateUniqueReminderCode } from '@/lib/reminder-code'

const createSchema = z.object({
  billIds: z.array(z.number().int().min(1)).min(1, '请至少选择一个账单'),
  method: z.string().min(1, '请选择催缴方式'),
  content: z.string().optional(),
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

function dayStartLocal(s: string): Date {
  const [y, m, d] = s.split(/\D/).map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}

function dayEndLocal(s: string): Date {
  const [y, m, d] = s.split(/\D/).map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999)
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
    const sentAtStart = searchParams.get('sentAtStart')?.trim() ?? ''
    const sentAtEnd = searchParams.get('sentAtEnd')?.trim() ?? ''
    const tenantName = searchParams.get('tenantName')?.trim() ?? ''
    const methodContains = searchParams.get('methodContains')?.trim() ?? ''

    const where: {
      companyId: number
      sentAt?: { gte?: Date; lte?: Date }
      method?: { contains: string }
    } = { companyId: user.companyId }

    if (sentAtStart && sentAtEnd) {
      where.sentAt = { gte: dayStartLocal(sentAtStart), lte: dayEndLocal(sentAtEnd) }
    } else if (sentAtStart) {
      where.sentAt = { gte: dayStartLocal(sentAtStart) }
    } else if (sentAtEnd) {
      where.sentAt = { lte: dayEndLocal(sentAtEnd) }
    }

    if (methodContains) {
      where.method = { contains: methodContains }
    }

    let reminders = await prisma.paymentReminder.findMany({
      where,
      orderBy: { id: 'desc' },
    })

    if (tenantName) {
      const tenantBills = await prisma.bill.findMany({
        where: {
          companyId: user.companyId,
          tenant: { companyName: { contains: tenantName } },
        },
        select: { id: true },
      })
      const idSet = new Set(tenantBills.map((b) => b.id))
      reminders = reminders.filter((r) => {
        const ids = parseJsonIds(r.billIds)
        return ids.some((id) => idSet.has(id))
      })
    }

    const billIdSets = reminders.map((r) => parseJsonIds(r.billIds))
    const allBillIds = [...new Set(billIdSets.flat())]
    const bills = allBillIds.length > 0
      ? await prisma.bill.findMany({
          where: { id: { in: allBillIds } },
          select: { id: true, code: true },
        })
      : []
    const billMap = Object.fromEntries(bills.map((b) => [b.id, b]))

    const list = reminders.map((r) => {
      const ids = parseJsonIds(r.billIds)
      const billCodes = ids.map((id) => billMap[id]?.code).filter(Boolean)
      return {
        id: r.id,
        code: r.code,
        billIds: ids,
        billCodes: billCodes.join(', '),
        method: r.method,
        content: r.content,
        status: r.status,
        sentAt: r.sentAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      data: { list },
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

    const bills = await prisma.bill.findMany({
      where: {
        id: { in: parsed.billIds },
        companyId: user.companyId,
      },
      select: { id: true },
    })
    if (bills.length === 0) {
      return NextResponse.json({ success: false, message: '没有有效的账单' }, { status: 400 })
    }

    const reminder = await prisma.$transaction(async (tx) => {
      const code = await allocateUniqueReminderCode(tx)
      return tx.paymentReminder.create({
        data: {
          code,
          billIds: JSON.stringify(parsed.billIds),
          method: parsed.method,
          content: parsed.content ?? null,
          notifyTargetId: 0,
          status: 'success',
          sentAt: new Date(),
          operatorId: user.id,
          companyId: user.companyId,
        },
      })
    })

    const billRows = await prisma.bill.findMany({
      where: {
        id: { in: parsed.billIds },
        companyId: user.companyId,
      },
      select: { id: true, code: true },
    })
    const op = authUserForLog(user)
    for (const b of billRows) {
      await logBillActivity(prisma, {
        billId: b.id,
        billCode: b.code,
        companyId: user.companyId,
        action: BILL_ACTION.REMINDER_RECORD,
        summary: `登记催缴记录（催缴单号 ${reminder.code}）`,
        meta: {
          reminderId: reminder.id,
          reminderCode: reminder.code,
          method: parsed.method,
        },
        operatorId: op.operatorId,
        operatorName: op.operatorName,
        operatorPhone: op.operatorPhone,
      })
    }

    return NextResponse.json({
      success: true,
      data: { id: reminder.id, code: reminder.code },
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
