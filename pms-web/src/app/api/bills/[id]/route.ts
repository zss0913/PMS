import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'
import { getBillRelatedRoomsForDetail } from '@/lib/bill-room-resolve'
import { fetchBillActivityLogsForBill } from '@/lib/bill-activity-log-db'
import {
  logBillActivity,
  BILL_ACTION,
  authUserForLog,
  billStatusZh,
} from '@/lib/bill-activity-log'

const updateSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  remark: z.string().optional(),
})

export async function GET(
  request: NextRequest,
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

    const { id } = await params
    const billId = parseInt(id, 10)
    if (isNaN(billId)) {
      return NextResponse.json({ success: false, message: '无效的账单ID' }, { status: 400 })
    }

    const bill = await prisma.bill.findFirst({
      where: { id: billId, companyId: user.companyId },
      include: {
        tenant: { select: { id: true, companyName: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        building: { select: { id: true, name: true } },
        rule: { select: { id: true, name: true, code: true } },
        account: {
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            accountHolder: true,
          },
        },
        payments: { include: { payment: true } },
        refunds: true,
      },
    })

    if (!bill) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    const [rooms, activityLogs] = await Promise.all([
      getBillRelatedRoomsForDetail(prisma, user.companyId, bill),
      fetchBillActivityLogsForBill(prisma, user.companyId, bill.id),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...bill,
        accountReceivable: Number(bill.accountReceivable),
        amountPaid: Number(bill.amountPaid),
        amountDue: Number(bill.amountDue),
        receiptIssuedAmount: Number(bill.receiptIssuedAmount ?? 0),
        invoiceIssuedAmount: Number(bill.invoiceIssuedAmount ?? 0),
        quantityTotal: bill.quantityTotal != null ? Number(bill.quantityTotal) : null,
        unitPrice: bill.unitPrice != null ? Number(bill.unitPrice) : null,
        roomsDisplay: formatBillRoomsDisplay(bill.remark, bill.room),
        rooms,
        activityLogs,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
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

    const { id } = await params
    const billId = parseInt(id, 10)
    if (isNaN(billId)) {
      return NextResponse.json({ success: false, message: '无效的账单ID' }, { status: 400 })
    }

    const existing = await prisma.bill.findFirst({
      where: { id: billId, companyId: user.companyId },
    })
    if (!existing) {
      return NextResponse.json({ success: false, message: '账单不存在' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (parsed.status !== undefined && parsed.status !== existing.status) {
      updateData.status = parsed.status
    }
    if (parsed.remark !== undefined) {
      const next = parsed.remark.trim()
      const prev = (existing.remark ?? '').trim()
      if (next !== prev) updateData.remark = parsed.remark
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: '无更新内容' }, { status: 400 })
    }

    const bill = await prisma.bill.update({
      where: { id: billId },
      data: updateData,
    })

    const changes: { field: string; label: string; from: string; to: string }[] = []
    if (updateData.status !== undefined) {
      changes.push({
        field: 'status',
        label: '状态',
        from: billStatusZh(existing.status),
        to: billStatusZh(bill.status),
      })
    }
    if (updateData.remark !== undefined) {
      changes.push({
        field: 'remark',
        label: '备注',
        from: (existing.remark ?? '').trim() || '（空）',
        to: (bill.remark ?? '').trim() || '（空）',
      })
    }

    const op = authUserForLog(user)
    await logBillActivity(prisma, {
      billId: bill.id,
      billCode: bill.code,
      companyId: user.companyId,
      action: BILL_ACTION.UPDATE,
      summary: '修改账单',
      changes,
      operatorId: op.operatorId,
      operatorName: op.operatorName,
      operatorPhone: op.operatorPhone,
    })

    return NextResponse.json({ success: true, data: bill })
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
