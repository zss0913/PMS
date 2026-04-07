import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveTenantIds } from '@/lib/mp-effective-tenant-ids'

export type MpNotificationKind = 'announcement' | 'bill' | 'work_order' | 'complaint' | 'app_message'

/** 租客端消息四大类（应用内催缴等归入「账单」） */
export type MpNotificationCategory = 'complaint' | 'work_order' | 'announcement' | 'bill'

export type MpNotificationItem = {
  key: string
  kind: MpNotificationKind
  title: string
  summary: string
  createdAt: string
  tenantId: number | null
  entityId: number
  buildingId?: number | null
  relatedBillId?: number | null
}

export function notificationCategory(kind: MpNotificationKind): MpNotificationCategory {
  if (kind === 'app_message') return 'bill'
  return kind
}

function num(v: unknown): string {
  if (v == null) return ''
  const n =
    typeof v === 'object' && v !== null && 'toNumber' in v ? (v as { toNumber: () => number }).toNumber() : Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : String(v)
}

/** 与 GET /api/mp/notifications 相同的聚合列表（按时间倒序、去重、最多 150 条） */
export async function collectMpNotificationItems(user: AuthUser): Promise<MpNotificationItem[]> {
  const tenantIds = await resolveEffectiveTenantIds(user)
  if (tenantIds.length === 0) {
    return []
  }

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds }, companyId: user.companyId },
    select: { id: true, buildingId: true, companyName: true },
  })
  const buildingIdByTenant = new Map(tenants.map((t) => [t.id, t.buildingId]))
  const defaultBuildingId = tenants[0]?.buildingId ?? null
  const bidStrs = [...new Set(tenants.map((t) => String(t.buildingId)))]

  const [announcements, bills, appMessages, woLogs, complaints] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        companyId: user.companyId,
        status: { in: ['published', '已发布'] },
        OR: [
          { scope: 'all' },
          ...bidStrs.map((bid) => ({
            scope: 'specified',
            buildingIds: { contains: bid },
          })),
        ],
      },
      orderBy: { publishTime: 'desc' },
      take: 50,
    }),
    prisma.bill.findMany({
      where: {
        companyId: user.companyId,
        tenantId: { in: tenantIds },
      },
      orderBy: { updatedAt: 'desc' },
      take: 60,
    }),
    prisma.tenantAppMessage.findMany({
      where: {
        companyId: user.companyId,
        tenantId: { in: tenantIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.workOrderActivityLog.findMany({
      where: {
        companyId: user.companyId,
        workOrder: {
          OR: [{ tenantId: { in: tenantIds } }, { reporterId: user.id }],
        },
      },
      include: {
        workOrder: { select: { id: true, code: true, title: true, tenantId: true, buildingId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.complaint.findMany({
      where: {
        companyId: user.companyId,
        reporterId: user.id,
        tenantId: { in: tenantIds },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
  ])

  const items: MpNotificationItem[] = []

  for (const a of announcements) {
    const t = a.publishTime ?? a.createdAt
    const tid =
      tenants.find((x) => {
        if (a.scope === 'all') return true
        const bid = String(x.buildingId)
        return typeof a.buildingIds === 'string' && a.buildingIds.includes(bid)
      })?.id ?? tenants[0]?.id
    const bId = tid != null ? buildingIdByTenant.get(tid) : defaultBuildingId
    items.push({
      key: `announcement:${a.id}`,
      kind: 'announcement',
      title: `公告：${a.title}`,
      summary: '物业发布了新公告，点击查看详情',
      createdAt: t.toISOString(),
      tenantId: tid ?? null,
      entityId: a.id,
      buildingId: bId,
    })
  }

  for (const b of bills) {
    const due = num(b.amountDue)
    items.push({
      key: `bill:${b.id}`,
      kind: 'bill',
      title: `账单「${b.code}」${b.feeType}`,
      summary: `${b.paymentStatus || b.status} · 待付 ${due} 元`,
      createdAt: b.updatedAt.toISOString(),
      tenantId: b.tenantId,
      entityId: b.id,
    })
  }

  for (const m of appMessages) {
    let relatedBillId: number | null = null
    try {
      const arr = JSON.parse(m.billIdsJson || '[]') as unknown
      if (Array.isArray(arr) && arr.length > 0) {
        const n = Number(arr[0])
        if (Number.isFinite(n) && n > 0) relatedBillId = n
      }
    } catch {
      relatedBillId = null
    }
    items.push({
      key: `app_message:${m.id}`,
      kind: 'app_message',
      title: m.title,
      summary: m.content.length > 80 ? `${m.content.slice(0, 80)}…` : m.content,
      createdAt: m.createdAt.toISOString(),
      tenantId: m.tenantId,
      entityId: m.id,
      relatedBillId,
    })
  }

  for (const log of woLogs) {
    const wo = log.workOrder
    if (!wo) continue
    const line = [log.summary, log.action].filter(Boolean).join(' · ')
    items.push({
      key: `work_order:${log.id}`,
      kind: 'work_order',
      title: `报事报修 ${wo.code}`,
      summary: line || '工单进度更新',
      createdAt: log.createdAt.toISOString(),
      tenantId: wo.tenantId,
      entityId: wo.id,
    })
  }

  for (const c of complaints) {
    const desc = c.description.length > 40 ? `${c.description.slice(0, 40)}…` : c.description
    items.push({
      key: `complaint:${c.id}`,
      kind: 'complaint',
      title: `卫生吐槽（${c.status}）`,
      summary: desc,
      createdAt: c.updatedAt.toISOString(),
      tenantId: c.tenantId,
      entityId: c.id,
    })
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const seen = new Set<string>()
  const deduped: MpNotificationItem[] = []
  for (const it of items) {
    if (seen.has(it.key)) continue
    seen.add(it.key)
    deduped.push(it)
    if (deduped.length >= 150) break
  }

  return deduped
}
