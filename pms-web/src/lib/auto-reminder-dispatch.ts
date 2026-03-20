import type { PrismaClient } from '@prisma/client'
import { buildBillWhereClause } from '@/lib/bill-filters'
import { BILL_ACTION } from '@/lib/bill-activity-log'
import { insertBillActivityLog } from '@/lib/bill-activity-log-db'
import { insertTenantAppMessage } from '@/lib/tenant-app-message-db'
import { allocateUniqueReminderCode } from '@/lib/reminder-code'

export type ChinaNowParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  monthKey: string
}

/** 上海时区下的日历与时间片段 */
export function getChinaDateParts(d: Date): ChinaNowParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10)
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  return {
    year,
    month,
    day,
    hour,
    minute,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
  }
}

/** 与 5 分钟级 Cron 对齐：在设定时间的 5 分钟内触发一次 */
export function isInSendTimeWindow(parts: ChinaNowParts, sendTime: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim())
  if (!m) return false
  const sendH = parseInt(m[1]!, 10)
  const sendM = parseInt(m[2]!, 10)
  if (sendH < 0 || sendH > 23 || sendM < 0 || sendM > 59) return false
  const nowMin = parts.hour * 60 + parts.minute
  const targetMin = sendH * 60 + sendM
  const endMin = Math.min(targetMin + 5, 24 * 60)
  return nowMin >= targetMin && nowMin < endMin
}

type BillWithTenant = {
  id: number
  code: string
  tenantId: number
  amountDue: unknown
  tenant: { id: number; companyName: string }
}

export type AutoReminderDispatchResult = {
  companyId: number
  skipped: boolean
  reason?: string
  tenantMessages?: number
  billCount?: number
}

/**
 * 对单企业：在启用自动催缴且到达发送窗口时，向所有逾期未结清账单按租客聚合发送应用内通知。
 * 同一自然月仅执行一次（由 lastAutoReminderMonth 保证）。
 */
export async function dispatchAutoReminderForCompany(
  db: PrismaClient,
  companyId: number,
  parts: ChinaNowParts
): Promise<AutoReminderDispatchResult> {
  const setting = await db.autoReminderSetting.findUnique({
    where: { companyId },
  })
  if (!setting?.isEnabled) {
    return { companyId, skipped: true, reason: 'not_enabled' }
  }
  if (setting.lastAutoReminderMonth === parts.monthKey) {
    return { companyId, skipped: true, reason: 'already_sent_this_month' }
  }
  if (parts.day !== setting.sendDay) {
    return { companyId, skipped: true, reason: 'wrong_day' }
  }
  if (!isInSendTimeWindow(parts, setting.sendTime)) {
    return { companyId, skipped: true, reason: 'outside_time_window' }
  }

  const where = {
    ...buildBillWhereClause(companyId, { overdue: 'true' }),
    status: 'open' as const,
  }

  const methodLabel = '应用内'
  const metaJson = JSON.stringify({
    sendSms: false,
    sendApp: true,
    generatePaperWord: false,
    autoReminder: true,
  })

  const billsOut = await db.$transaction(async (tx) => {
    const s = await tx.autoReminderSetting.findUnique({ where: { companyId } })
    if (!s?.isEnabled || s.lastAutoReminderMonth === parts.monthKey) {
      return null
    }
    if (parts.day !== s.sendDay || !isInSendTimeWindow(parts, s.sendTime)) {
      return null
    }

    const bills = (await tx.bill.findMany({
      where,
      include: {
        tenant: { select: { id: true, companyName: true } },
      },
      orderBy: { id: 'asc' },
    })) as BillWithTenant[]

    if (bills.length === 0) {
      await tx.autoReminderSetting.update({
        where: { companyId },
        data: { lastAutoReminderMonth: parts.monthKey },
      })
      return [] as BillWithTenant[]
    }

    const byTenant = new Map<number, BillWithTenant[]>()
    for (const b of bills) {
      const arr = byTenant.get(b.tenantId) ?? []
      arr.push(b)
      byTenant.set(b.tenantId, arr)
    }
    const tenantIds = [...byTenant.keys()].sort((a, b) => a - b)

    for (const tenantId of tenantIds) {
      const group = byTenant.get(tenantId)!
      const code = await allocateUniqueReminderCode(tx)
      await tx.paymentReminder.create({
        data: {
          code,
          billIds: JSON.stringify(group.map((b) => b.id)),
          method: methodLabel,
          content: null,
          notifyTargetId: 0,
          status: 'success',
          sentAt: new Date(),
          operatorId: 0,
          companyId,
        },
      })
    }

    for (const tenantId of tenantIds) {
      const group = byTenant.get(tenantId)!
      const totalDue = group.reduce((s, b) => s + Number(b.amountDue), 0)
      const billIds = group.map((b) => b.id)
      const lines = group
        .map((b) => `${b.code} 待缴 ¥${Number(b.amountDue).toFixed(2)}`)
        .join('\n')
      await insertTenantAppMessage(tx, {
        tenantId,
        companyId,
        title: '【账单催缴通知】',
        content: `尊敬的 ${group[0]!.tenant.companyName} 管理员：\n\n（系统自动催缴）您有以下逾期账单待缴，合计 ¥${totalDue.toFixed(2)}：\n${lines}`,
        billIdsJson: JSON.stringify(billIds),
      })
    }

    await tx.autoReminderSetting.update({
      where: { companyId },
      data: { lastAutoReminderMonth: parts.monthKey },
    })

    return bills
  })

  if (billsOut === null) {
    return { companyId, skipped: true, reason: 'race_or_settings_changed' }
  }

  if (billsOut.length === 0) {
    return { companyId, skipped: false, tenantMessages: 0, billCount: 0 }
  }

  await Promise.all(
    billsOut.map((b) =>
      insertBillActivityLog(db, {
        billId: b.id,
        billCode: b.code,
        companyId,
        action: BILL_ACTION.DUNNING_EXPORT,
        summary: `自动催缴通知（${methodLabel}）`,
        metaJson,
        operatorId: 0,
        operatorName: '系统',
        operatorPhone: '',
      })
    )
  )

  const tenantSet = new Set(billsOut.map((b) => b.tenantId))
  return {
    companyId,
    skipped: false,
    tenantMessages: tenantSet.size,
    billCount: billsOut.length,
  }
}

export async function dispatchAutoRemindersForAllCompanies(
  db: PrismaClient,
  at: Date = new Date()
): Promise<{ parts: ChinaNowParts; results: AutoReminderDispatchResult[] }> {
  const parts = getChinaDateParts(at)
  const settings = await db.autoReminderSetting.findMany({
    where: { isEnabled: true },
    select: { companyId: true },
  })
  const results: AutoReminderDispatchResult[] = []
  for (const { companyId } of settings) {
    const r = await dispatchAutoReminderForCompany(db, companyId, parts)
    results.push(r)
  }
  return { parts, results }
}
