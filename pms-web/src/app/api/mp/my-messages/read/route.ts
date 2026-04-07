import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 标记员工站内通知为已读（StaffNotification.id） */
export async function POST(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'employee') {
      return NextResponse.json({ success: false, message: '未登录或无权限' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      notificationId?: unknown
      notificationIds?: unknown
      markAll?: unknown
    }

    if (body.markAll === true) {
      const now = new Date()
      await prisma.staffNotification.updateMany({
        where: {
          companyId: user.companyId,
          employeeId: user.id,
          readAt: null,
        },
        data: { readAt: now },
      })
      return NextResponse.json({ success: true })
    }

    const rawIds: number[] = []
    if (typeof body.notificationId === 'number' && Number.isFinite(body.notificationId)) {
      rawIds.push(body.notificationId)
    }
    if (Array.isArray(body.notificationIds)) {
      for (const x of body.notificationIds) {
        const n = typeof x === 'number' ? x : Number(x)
        if (Number.isFinite(n) && n > 0) rawIds.push(n)
      }
    }

    const ids = [...new Set(rawIds)]
    if (ids.length === 0) {
      return NextResponse.json({ success: false, message: '请传入 notificationId' }, { status: 400 })
    }

    const now = new Date()
    await prisma.staffNotification.updateMany({
      where: {
        id: { in: ids },
        companyId: user.companyId,
        employeeId: user.id,
      },
      data: { readAt: now },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
