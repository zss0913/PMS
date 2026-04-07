import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 租客/员工端：公告详情（可见性与列表接口一致） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMpAuthUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const { id } = await params
  const nid = parseInt(id, 10)
  if (Number.isNaN(nid)) {
    return NextResponse.json({ success: false, message: '无效的公告ID' }, { status: 400 })
  }

  const buildingId = request.nextUrl.searchParams.get('buildingId')

  const row = await prisma.announcement.findFirst({
    where: {
      id: nid,
      companyId: user.companyId,
      status: { in: ['published', '已发布'] },
      OR: [
        { scope: 'all' },
        ...(buildingId
          ? [{ scope: 'specified', buildingIds: { contains: buildingId } }]
          : []),
      ],
    },
    include: {
      company: { select: { name: true } },
    },
  })

  if (!row) {
    return NextResponse.json({ success: false, message: '公告不存在' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    announcement: {
      id: row.id,
      title: row.title,
      content: row.content,
      publishTime: row.publishTime?.toISOString() ?? '',
      scope: row.scope,
      publisherName: row.publisherName ?? null,
      companyName: row.company.name,
    },
  })
}
