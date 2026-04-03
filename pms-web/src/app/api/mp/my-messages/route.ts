import { NextRequest, NextResponse } from 'next/server'
import type { StaffNotification } from '@prisma/client'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type MyMessageItem = {
  kind: 'announcement' | 'work_order' | 'inspection_task' | 'complaint'
  id: number
  title: string
  summary: string
  time: string
  link?: { type: 'work_order' | 'inspection_task' | 'complaint'; id: number }
  content?: string
}

/** 员工端：物业公告 + 业务通知统一时间线 */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }
  if (user.type !== 'employee') {
    return NextResponse.json({ success: false, message: '仅员工端可用' }, { status: 403 })
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

  let staffRows: StaffNotification[] = []
  try {
    staffRows = await prisma.staffNotification.findMany({
      where: {
        companyId: user.companyId,
        employeeId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  } catch {
    // 表未迁移时仍返回公告列表
    staffRows = []
  }

  const items: MyMessageItem[] = []

  for (const a of announcements) {
    const t = a.publishTime ?? a.createdAt
    items.push({
      kind: 'announcement',
      id: a.id,
      title: a.title,
      summary: a.content.length > 120 ? `${a.content.slice(0, 120)}…` : a.content,
      time: t.toISOString(),
      content: a.content,
    })
  }

  for (const n of staffRows) {
    const cat = n.category
    if (cat === 'work_order') {
      items.push({
        kind: 'work_order',
        id: n.id,
        title: n.title,
        summary: n.summary ?? '',
        time: n.createdAt.toISOString(),
        link: { type: 'work_order', id: n.entityId },
      })
    } else if (cat === 'inspection_task') {
      items.push({
        kind: 'inspection_task',
        id: n.id,
        title: n.title,
        summary: n.summary ?? '',
        time: n.createdAt.toISOString(),
        link: { type: 'inspection_task', id: n.entityId },
      })
    } else if (cat === 'complaint') {
      items.push({
        kind: 'complaint',
        id: n.id,
        title: n.title,
        summary: n.summary ?? '',
        time: n.createdAt.toISOString(),
        link: { type: 'complaint', id: n.entityId },
      })
    }
  }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return NextResponse.json({ success: true, list: items })
}
