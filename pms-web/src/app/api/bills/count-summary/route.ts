import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildBillWhereClause } from '@/lib/bill-filters'

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
    const where = buildBillWhereClause(user.companyId, {
      buildingId: searchParams.get('buildingId'),
      tenantId: searchParams.get('tenantId'),
      status: searchParams.get('status'),
      paymentStatus: searchParams.get('paymentStatus'),
      overdue: searchParams.get('overdue'),
      feeType: searchParams.get('feeType'),
      dueDateStart: searchParams.get('dueDateStart'),
      dueDateEnd: searchParams.get('dueDateEnd'),
    })

    const billCount = await prisma.bill.count({ where })
    const groups = await prisma.bill.groupBy({
      by: ['tenantId'],
      where,
      _count: { _all: true },
    })
    const tenantCount = groups.length

    return NextResponse.json({
      success: true,
      data: { billCount, tenantCount },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
