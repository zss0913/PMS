import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  collectMpNotificationItems,
  notificationCategory,
  type MpNotificationCategory,
} from '@/lib/mp-notification-items'

const CATEGORIES: MpNotificationCategory[] = ['complaint', 'work_order', 'announcement', 'bill']

/** 标记已读：传 keys[] 或 category（该分类下当前列表全部标记） */
export async function POST(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json({ success: false, message: '未登录或无权限' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      keys?: unknown
      category?: unknown
    }

    let keysToMark: string[] = []

    if (Array.isArray(body.keys) && body.keys.length > 0) {
      keysToMark = [...new Set(body.keys.filter((k): k is string => typeof k === 'string' && k.length > 0))]
    } else if (typeof body.category === 'string' && (CATEGORIES as string[]).includes(body.category)) {
      const items = await collectMpNotificationItems(user)
      keysToMark = items
        .filter((it) => notificationCategory(it.kind) === body.category)
        .map((it) => it.key)
    } else {
      return NextResponse.json({ success: false, message: '请传入 keys 或有效的 category' }, { status: 400 })
    }

    if (keysToMark.length === 0) {
      return NextResponse.json({ success: true, marked: 0 })
    }

    try {
      await prisma.$transaction(
        keysToMark.map((notificationKey) =>
          prisma.tenantNotificationRead.upsert({
            where: {
              tenantUserId_notificationKey: {
                tenantUserId: user.id,
                notificationKey,
              },
            },
            create: { tenantUserId: user.id, notificationKey },
            update: {},
          })
        )
      )
    } catch (dbErr) {
      console.error('[mp/notifications/read] 写入已读失败（请确认已执行 npx prisma db push）', dbErr)
      return NextResponse.json(
        {
          success: false,
          message: '消息已读功能需要更新数据库，请联系管理员执行 prisma 迁移',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ success: true, marked: keysToMark.length })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
