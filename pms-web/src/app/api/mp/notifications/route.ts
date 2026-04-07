import { NextRequest, NextResponse } from 'next/server'
import { getMpAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  collectMpNotificationItems,
  notificationCategory,
  type MpNotificationItem,
} from '@/lib/mp-notification-items'

export type { MpNotificationItem } from '@/lib/mp-notification-items'

type MpNotificationItemWithRead = MpNotificationItem & { read: boolean }

/** 租客端：聚合公告 / 账单 / 工单动态 / 卫生吐槽 / 应用内消息（催缴等），按当前 JWT 生效租客范围；含已读状态与分类未读数 */
export async function GET(request: NextRequest) {
  try {
    const user = await getMpAuthUser(request)
    if (!user || user.type !== 'tenant') {
      return NextResponse.json({ success: false, message: '未登录或无权限' }, { status: 401 })
    }

    const deduped = await collectMpNotificationItems(user)

    const keys = deduped.map((i) => i.key)
    let readSet = new Set<string>()
    if (keys.length > 0) {
      try {
        const reads = await prisma.tenantNotificationRead.findMany({
          where: { tenantUserId: user.id, notificationKey: { in: keys } },
          select: { notificationKey: true },
        })
        readSet = new Set(reads.map((r) => r.notificationKey))
      } catch (readErr) {
        // 常见原因：未执行 prisma migrate/db push，尚无 TenantNotificationRead 表
        console.error('[mp/notifications] tenantNotificationRead 查询失败（可执行 npx prisma db push）', readErr)
      }
    }

    const list: MpNotificationItemWithRead[] = deduped.map((it) => ({
      ...it,
      read: readSet.has(it.key),
    }))

    const unreadCounts = {
      complaint: 0,
      work_order: 0,
      announcement: 0,
      bill: 0,
    }
    for (const it of list) {
      if (it.read) continue
      unreadCounts[notificationCategory(it.kind)]++
    }

    return NextResponse.json({ success: true, list, unreadCounts })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
