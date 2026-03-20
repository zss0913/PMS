import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** GET ?ids=1,2,3 返回开具收据表单所需账单信息（须已登录且属本公司） */
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

    const idsParam = request.nextUrl.searchParams.get('ids')
    if (!idsParam?.trim()) {
      return NextResponse.json({ success: false, message: '请传入账单 id（ids=1,2,3）' }, { status: 400 })
    }
    const rawIds = idsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0)
    const ids = [...new Set(rawIds)]
    if (ids.length === 0) {
      return NextResponse.json({ success: false, message: '无效的账单 id' }, { status: 400 })
    }

    const bills = await prisma.bill.findMany({
      where: {
        id: { in: ids },
        companyId: user.companyId,
      },
      include: {
        tenant: { select: { companyName: true } },
      },
    })

    if (bills.length !== ids.length) {
      return NextResponse.json(
        { success: false, message: '部分账单不存在或无权访问' },
        { status: 400 }
      )
    }

    const map = new Map(bills.map((b) => [b.id, b]))
    const ordered = ids.map((id) => map.get(id)!).filter(Boolean)

    const list = ordered.map((b) => {
      const ar = Number(b.accountReceivable)
      const paid = Number(b.amountPaid ?? 0)
      const issued = Number(b.receiptIssuedAmount ?? 0)
      const remaining = Math.max(0, ar - issued)
      return {
        id: b.id,
        tenantId: b.tenantId,
        code: b.code,
        tenantName: b.tenant.companyName,
        feeType: b.feeType,
        period: b.period,
        accountReceivable: ar,
        amountPaid: paid,
        receiptIssuedAmount: issued,
        remainingReceiptable: remaining,
        dueDate: b.dueDate.toISOString().slice(0, 10),
      }
    })

    return NextResponse.json({ success: true, data: { list } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
