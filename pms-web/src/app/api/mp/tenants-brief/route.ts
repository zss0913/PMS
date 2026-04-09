import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 员工小程序/H5：下拉选择费用承担租客（轻量列表） */
export async function GET(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.type !== 'employee' || user.companyId === 0) {
      return NextResponse.json({ success: false, message: '仅物业员工可操作' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const bid = searchParams.get('buildingId')
    const buildingIdNum = bid != null ? parseInt(bid, 10) : NaN

    const where: { companyId: number; buildingId?: number } = { companyId: user.companyId }
    if (Number.isFinite(buildingIdNum) && buildingIdNum > 0) {
      where.buildingId = buildingIdNum
    }

    const list = await prisma.tenant.findMany({
      where,
      select: { id: true, companyName: true },
      orderBy: { id: 'desc' },
      take: 300,
    })

    return NextResponse.json({ success: true, data: { list } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
