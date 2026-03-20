/**
 * 账单金额：规则单价为「元/㎡/月」，先算单间月应收，再按账期拆成整月 + 零散天。
 * 零散天与「不足整月」段：按自然日逐日折算，日单价 = 月应收 ÷ 该日所在月的实际天数（28/29/30/31）。
 */

function parseDateOnly(s: string): Date {
  const parts = s.trim().split(/\D/).filter(Boolean).map(Number)
  if (parts.length < 3) return new Date(NaN)
  const [y, m, d] = parts
  return new Date(y, m - 1, d)
}

function addCalendarMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime())
  const day = r.getDate()
  r.setMonth(r.getMonth() + n)
  if (r.getDate() < day) {
    r.setDate(0)
  }
  return r
}

/** 该自然月天数（含闰年 2 月 29 天） */
function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

export type BillingPeriodSplit =
  /** 不足一个「整月」周期：按起止日（含首尾）计总天数 */
  | { kind: 'short'; totalDays: number }
  /** 已满若干整月，另加 cursor 之后的零散天 */
  | { kind: 'norm'; months: number; extraDays: number }

/**
 * 与界面「账期时长」同一套拆法：先尽可能加整月，余下为 extraDays。
 */
export function splitBillingPeriod(startStr: string, endStr: string): BillingPeriodSplit | null {
  const DAY = 86400000
  const start = parseDateOnly(startStr)
  const end = parseDateOnly(endStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end < start) return null

  let months = 0
  let cursor = new Date(start.getTime())
  while (true) {
    const next = addCalendarMonths(cursor, 1)
    if (next <= end) {
      months++
      cursor = next
    } else break
  }
  const extraDays = Math.round((end.getTime() - cursor.getTime()) / DAY)
  if (months === 0) {
    const totalDays = Math.round((end.getTime() - start.getTime()) / DAY) + 1
    return { kind: 'short', totalDays }
  }
  return { kind: 'norm', months, extraDays }
}

/** 整月扣完后，账期开始一侧的「截止日」（与 split 中 cursor 一致），用于零散天起算 */
export function getCursorAfterFullMonths(startStr: string, endStr: string): Date | null {
  const start = parseDateOnly(startStr)
  const end = parseDateOnly(endStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  let cursor = new Date(start.getTime())
  cursor.setHours(0, 0, 0, 0)
  const endNorm = new Date(end)
  endNorm.setHours(0, 0, 0, 0)
  while (true) {
    const next = addCalendarMonths(cursor, 1)
    if (next <= endNorm) {
      cursor = next
    } else break
  }
  return cursor
}

/** 起止日（含首尾）逐日按「当月天数」折算之和 */
export function sumProratedByCalendarDays(
  startInclusive: Date,
  endInclusive: Date,
  monthlyNet: number
): number {
  let sum = 0
  const d = new Date(startInclusive)
  d.setHours(0, 0, 0, 0)
  const end = new Date(endInclusive)
  end.setHours(0, 0, 0, 0)
  const endTs = end.getTime()
  while (d.getTime() <= endTs) {
    const dim = daysInMonth(d.getFullYear(), d.getMonth())
    sum += monthlyNet / dim
    d.setDate(d.getDate() + 1)
  }
  return sum
}

/** 与 sumProratedByCalendarDays 同逻辑，生成算式片段：如 11×(6000÷31)+3×(6000÷28) */
export function formatProrationBreakdown(
  monthlyNet: number,
  startInclusive: Date,
  endInclusive: Date
): string {
  const byMonth = new Map<string, { count: number; dim: number }>()
  let d = new Date(startInclusive)
  d.setHours(0, 0, 0, 0)
  const end = new Date(endInclusive)
  end.setHours(0, 0, 0, 0)
  const endTs = end.getTime()
  while (d.getTime() <= endTs) {
    const y = d.getFullYear()
    const m = d.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const dim = daysInMonth(y, m)
    const prev = byMonth.get(key)
    if (prev) prev.count++
    else byMonth.set(key, { count: 1, dim })
    d.setDate(d.getDate() + 1)
  }
  const keys = [...byMonth.keys()].sort()
  return keys
    .map((k) => {
      const { count, dim } = byMonth.get(k)!
      return `${count}×(${monthlyNet.toFixed(2)}÷${dim})`
    })
    .join('+')
}

/** 单间每月应收（元/月）：max(0, 单价×面积×(1−折扣率)−减免额) */
export function computeMonthlyNetRoom(
  amountPerSqm: number,
  leaseArea: number,
  discountRate: number,
  discountAmount: number
): { monthlyNet: number; rawMonthly: number } {
  const rawMonthly = amountPerSqm * leaseArea * (1 - discountRate) - discountAmount
  const monthlyNet = Math.max(0, rawMonthly)
  return { monthlyNet, rawMonthly }
}

export function computePeriodReceivableFromMonthly(
  monthlyNet: number,
  split: BillingPeriodSplit,
  periodStartStr: string,
  periodEndStr: string
): number {
  if (monthlyNet <= 0) return 0
  const pe = parseDateOnly(periodEndStr)
  if (Number.isNaN(pe.getTime())) return 0

  if (split.kind === 'short') {
    const ps = parseDateOnly(periodStartStr)
    if (Number.isNaN(ps.getTime())) return 0
    return Math.max(0, sumProratedByCalendarDays(ps, pe, monthlyNet))
  }

  let total = split.months * monthlyNet
  if (split.extraDays > 0) {
    const cursor = getCursorAfterFullMonths(periodStartStr, periodEndStr)
    if (!cursor) return Math.max(0, total)
    const firstPartial = new Date(cursor)
    firstPartial.setDate(firstPartial.getDate() + 1)
    firstPartial.setHours(0, 0, 0, 0)
    total += sumProratedByCalendarDays(firstPartial, pe, monthlyNet)
  }
  return Math.max(0, total)
}

/** 与 BillList 中「账期时长」文案一致 */
export function formatBillingPeriodDuration(startStr: string, endStr: string): string {
  const DAY = 86400000
  const start = parseDateOnly(startStr)
  const end = parseDateOnly(endStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-'
  if (end < start) return '-'
  if (start.getTime() === end.getTime()) return '1天'

  let months = 0
  let cursor = new Date(start.getTime())
  while (true) {
    const next = addCalendarMonths(cursor, 1)
    if (next <= end) {
      months++
      cursor = next
    } else break
  }
  const extraDays = Math.round((end.getTime() - cursor.getTime()) / DAY)
  if (months === 0) {
    const totalDays = Math.round((end.getTime() - start.getTime()) / DAY) + 1
    return `${totalDays}天`
  }
  if (extraDays === 0) return `${months}个月`
  return `${months}个月${extraDays}天`
}

function formatDiscountInFormula(rate: number): string {
  const r = Number(rate)
  if (Number.isNaN(r)) return '?'
  if (r >= 0 && r <= 1) return `${(r * 100).toFixed(2)}%`
  return `${r}%`
}

export function buildRoomReceivableFormulaLine(opts: {
  amountPerSqm: number
  leaseArea: number
  discountRate: number
  discountAmount: number
  periodStart: string
  periodEnd: string
  receivable: number
}): string {
  const { amountPerSqm, leaseArea, discountRate, discountAmount, periodStart, periodEnd, receivable } =
    opts
  const ap = amountPerSqm.toFixed(2)
  const la = Number.isInteger(leaseArea) ? String(leaseArea) : Number(leaseArea).toFixed(2)
  const ded = discountAmount.toFixed(2)
  const inner = `${ap}×${la}×(1-${formatDiscountInFormula(discountRate)})-${ded}`
  const { monthlyNet, rawMonthly } = computeMonthlyNetRoom(
    amountPerSqm,
    leaseArea,
    discountRate,
    discountAmount
  )

  const monthlyPart =
    rawMonthly < 0 ? `月应收=max(0,${inner})=0.00` : `月应收=max(0,${inner})=${monthlyNet.toFixed(2)}`

  if (monthlyNet === 0) {
    return `${monthlyPart}；账期应收=0.00`
  }

  const split = splitBillingPeriod(periodStart, periodEnd)
  if (!split) {
    return `${monthlyPart}；账期无效`
  }

  const ps = parseDateOnly(periodStart)
  const pe = parseDateOnly(periodEnd)
  if (Number.isNaN(ps.getTime()) || Number.isNaN(pe.getTime())) {
    return `${monthlyPart}；账期日期无效`
  }

  if (split.kind === 'short') {
    const breakdown = formatProrationBreakdown(monthlyNet, ps, pe)
    const periodPart = `${breakdown}=${receivable.toFixed(2)}`
    return `${monthlyPart}；${periodPart}`
  }

  if (split.extraDays === 0) {
    const periodPart = `${split.months}×${monthlyNet.toFixed(2)}=${receivable.toFixed(2)}`
    return `${monthlyPart}；${periodPart}`
  }

  const cursor = getCursorAfterFullMonths(periodStart, periodEnd)
  if (!cursor) {
    return `${monthlyPart}；账期无效`
  }
  const firstPartial = new Date(cursor)
  firstPartial.setDate(firstPartial.getDate() + 1)
  firstPartial.setHours(0, 0, 0, 0)
  const breakdown = formatProrationBreakdown(monthlyNet, firstPartial, pe)
  const periodPart = `${split.months}×${monthlyNet.toFixed(2)}+${breakdown}=${receivable.toFixed(2)}`
  return `${monthlyPart}；${periodPart}`
}
