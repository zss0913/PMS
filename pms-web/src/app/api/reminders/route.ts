import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

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

    const reminders = await prisma.paymentReminder.findMany({
      where: { companyId: user.companyId },
      orderBy: { id: 'desc' },
    })

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

    const count = await prisma.paymentReminder.count({ where: { companyId: user.companyId } })
    const code = `REM${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(count + 1).padStart(4, '0')}`

    const reminder = await prisma.paymentReminder.create({
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
