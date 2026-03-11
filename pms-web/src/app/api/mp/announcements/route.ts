import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 租客/员工端：获取公告列表，按楼宇筛选 */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { success: false, message: '未登录' },
      { status: 401 }
    )
  }

  const buildingId = request.nextUrl.searchParams.get('buildingId')
  const announcements = await prisma.announcement.findMany({
    where: {
      companyId: user.companyId,
      status: { in: ['published', '已发布'] },
      OR: [
        { scope: 'all' },
        ...(buildingId
          ? [{ scope: 'specified', buildingIds: { contains: buildingId } }]
          : []),
      ],
    },
    orderBy: { publishTime: 'desc' },
    take: 50,
  })

  const list = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    publishTime: a.publishTime,
    scope: a.scope,
  }))

  return NextResponse.json({ success: true, list })
}
