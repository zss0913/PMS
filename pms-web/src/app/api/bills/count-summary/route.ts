import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildBillWhereClause, filterBillsByPeriodOverlap } from '@/lib/bill-filters'

/** GET 与 /api/bills 相同筛选参数，仅返回条数与涉及租客数（用于催缴抽屉预览） */
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

    const rows = await prisma.bill.findMany({
      where,
      select: { id: true, period: true, tenantId: true },
    })
    const filtered = filterBillsByPeriodOverlap(rows, periodStart, periodEnd)
    const billCount = filtered.length
    const tenantCount = new Set(filtered.map((r) => r.tenantId)).size

    return NextResponse.json({
      success: true,
      data: { billCount, tenantCount },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
