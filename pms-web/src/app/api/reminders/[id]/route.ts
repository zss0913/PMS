import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) {
      return NextResponse.json({ success: false, message: '无效的 ID' }, { status: 400 })
    }

    const reminder = await prisma.paymentReminder.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!reminder) {
      return NextResponse.json({ success: false, message: '催缴记录不存在' }, { status: 404 })
    }

    const billIds = parseJsonIds(reminder.billIds)
    const bills =
      billIds.length > 0
        ? await prisma.bill.findMany({
            where: { id: { in: billIds }, companyId: user.companyId },
            include: {
              tenant: { select: { id: true, companyName: true } },
              building: { select: { id: true, name: true } },
            },
            orderBy: { id: 'asc' },
          })
        : []

    return NextResponse.json({
      success: true,
      data: {
        reminder: {
          id: reminder.id,
          code: reminder.code,
          billIds,
          method: reminder.method,
          content: reminder.content,
          status: reminder.status,
          sentAt: reminder.sentAt.toISOString(),
          createdAt: reminder.createdAt.toISOString(),
        },
        bills: bills.map((b) => ({
          id: b.id,
          code: b.code,
          feeType: b.feeType,
          period: b.period,
          accountReceivable: Number(b.accountReceivable),
          amountPaid: Number(b.amountPaid),
          amountDue: Number(b.amountDue),
          paymentStatus: b.paymentStatus,
          dueDate: b.dueDate.toISOString().slice(0, 10),
          tenant: b.tenant
            ? { id: b.tenant.id, companyName: b.tenant.companyName }
            : null,
          buildingName: b.building?.name ?? null,
        })),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
