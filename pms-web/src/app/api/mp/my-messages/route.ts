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
  /** 业务通知：是否已读（StaffNotification.readAt） */
  read?: boolean
  link?: { type: 'work_order' | 'inspection_task' | 'complaint'; id: number }
  content?: string
}

export type StaffMessageUnreadCounts = {
  work_order: number
  inspection_task: number
  complaint: number
}

/** 员工端：物业公告 + 业务通知（工单/巡检/吐槽）；业务类含已读状态与分类未读数 */
export async function GET(request: NextRequest) {
  const user = await getMpAuthUser(request)
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }
  if (user.type !== 'employee') {
    return NextResponse.json({ success: false, message: '仅员工端可用' }, { status: 403 })
  }

  const buildingId = request.nextUrl.searchParams.get('buildingId')

  const announcementRows = await prisma.announcement.findMany({
    where: {
      companyId: user.companyId,
      status: { in: ['published', '已发布'] },
      OR: [
        { scope: 'all' },
        ...(buildingId ? [{ scope: 'specified', buildingIds: { contains: buildingId } }] : []),
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
    staffRows = []
  }

  const announcements: MyMessageItem[] = []
  for (const a of announcementRows) {
    const t = a.publishTime ?? a.createdAt
    announcements.push({
      kind: 'announcement',
      id: a.id,
      title: a.title,
      summary: a.content.length > 120 ? `${a.content.slice(0, 120)}…` : a.content,
      time: t.toISOString(),
      read: true,
      content: a.content,
    })
  }

  const businessItems: MyMessageItem[] = []
  for (const n of staffRows) {
    const cat = n.category
    const read = n.readAt != null
    if (cat === 'work_order') {
      businessItems.push({
        kind: 'work_order',
        id: n.id,
        title: n.title,
        summary: n.summary ?? '',
        time: n.createdAt.toISOString(),
        read,
        link: { type: 'work_order', id: n.entityId },
      })
    } else if (cat === 'inspection_task') {
      businessItems.push({
        kind: 'inspection_task',
        id: n.id,
        title: n.title,
        summary: n.summary ?? '',
        time: n.createdAt.toISOString(),
        read,
        link: { type: 'inspection_task', id: n.entityId },
      })
    } else if (cat === 'complaint') {
      businessItems.push({
        kind: 'complaint',
        id: n.id,
        title: n.title,
        summary: n.summary ?? '',
        time: n.createdAt.toISOString(),
        read,
        link: { type: 'complaint', id: n.entityId },
      })
    }
  }

  businessItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const unreadCounts: StaffMessageUnreadCounts = {
    work_order: staffRows.filter((n) => n.category === 'work_order' && n.readAt == null).length,
    inspection_task: staffRows.filter((n) => n.category === 'inspection_task' && n.readAt == null).length,
    complaint: staffRows.filter((n) => n.category === 'complaint' && n.readAt == null).length,
  }

  /** 兼容旧端：合并时间线（公告 + 业务） */
  const list: MyMessageItem[] = [...announcements, ...businessItems].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  )

  return NextResponse.json({
    success: true,
    announcements,
    list,
    business: businessItems,
    unreadCounts,
  })
}
