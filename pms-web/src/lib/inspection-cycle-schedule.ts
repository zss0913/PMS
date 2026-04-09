import { shouldGenerateOnDate, isoWeekday, type CyclePlanLike } from '@/lib/inspection-cycle'

export const CYCLE_SCHEDULE_VERSION = 1 as const

export type DailySlot = { time: string }
export type WeeklySlot = { weekday: number; time: string }
export type MonthlySlot = { monthDay: number; time: string }

export type CycleScheduleV1 =
  | { v: typeof CYCLE_SCHEDULE_VERSION; kind: 'daily'; slots: DailySlot[] }
  | { v: typeof CYCLE_SCHEDULE_VERSION; kind: 'weekly'; slots: WeeklySlot[] }
  | { v: typeof CYCLE_SCHEDULE_VERSION; kind: 'monthly'; slots: MonthlySlot[] }

export function combineDateAndTime(dayStart: Date, timeHHmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeHHmm.trim())
  if (!m) return new Date(dayStart)
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  const d = new Date(dayStart)
  d.setHours(h, min, 0, 0)
  return d
}

export function parseCycleSchedule(raw: string | null | undefined): CycleScheduleV1 | null {
  if (!raw?.trim()) return null
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return null
    const x = o as Record<string, unknown>
    if (x.v !== CYCLE_SCHEDULE_VERSION) return null
    const kind = x.kind
    if (kind === 'daily' && Array.isArray(x.slots)) {
      return { v: CYCLE_SCHEDULE_VERSION, kind: 'daily', slots: x.slots as DailySlot[] }
    }
    if (kind === 'weekly' && Array.isArray(x.slots)) {
      return { v: CYCLE_SCHEDULE_VERSION, kind: 'weekly', slots: x.slots as WeeklySlot[] }
    }
    if (kind === 'monthly' && Array.isArray(x.slots)) {
      return { v: CYCLE_SCHEDULE_VERSION, kind: 'monthly', slots: x.slots as MonthlySlot[] }
    }
    return null
  } catch {
    return null
  }
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function validateCycleSchedule(
  cycleType: string,
  cycleValue: number,
  schedule: CycleScheduleV1
): { ok: true } | { ok: false; message: string } {
  const n = Math.max(1, cycleValue)
  if (schedule.v !== CYCLE_SCHEDULE_VERSION) {
    return { ok: false, message: '周期时刻格式无效' }
  }
  if (cycleType === '每天') {
    if (schedule.kind !== 'daily') return { ok: false, message: '周期类型与时刻配置不一致' }
    if (schedule.slots.length !== n) return { ok: false, message: `每天须配置 ${n} 个执行时间点` }
    for (const s of schedule.slots) {
      if (!s?.time || !TIME_RE.test(s.time)) return { ok: false, message: '请填写有效的时刻（HH:mm）' }
    }
    return { ok: true }
  }
  if (cycleType === '每周') {
    if (schedule.kind !== 'weekly') return { ok: false, message: '周期类型与时刻配置不一致' }
    if (schedule.slots.length !== n) return { ok: false, message: `每周须配置 ${n} 次执行（周几+时刻）` }
    for (const s of schedule.slots) {
      if (!s?.time || !TIME_RE.test(s.time)) return { ok: false, message: '请填写有效的时刻（HH:mm）' }
      const wd = Number(s.weekday)
      if (!Number.isFinite(wd) || wd < 1 || wd > 7) return { ok: false, message: '周几须为 1–7（周一至周日）' }
    }
    return { ok: true }
  }
  if (cycleType === '每月') {
    if (schedule.kind !== 'monthly') return { ok: false, message: '周期类型与时刻配置不一致' }
    if (schedule.slots.length !== n) return { ok: false, message: `每月须配置 ${n} 次执行（日期+时刻）` }
    for (const s of schedule.slots) {
      if (!s?.time || !TIME_RE.test(s.time)) return { ok: false, message: '请填写有效的时刻（HH:mm）' }
      const md = Number(s.monthDay)
      if (!Number.isFinite(md) || md < 1 || md > 28) return { ok: false, message: '每月日期须为 1–28' }
    }
    return { ok: true }
  }
  return { ok: false, message: '未知周期类型' }
}

export type PlanForSchedule = {
  cycleType: string
  cycleValue: number
  cycleSchedule: string | null
  cycleWeekday: number | null
  cycleMonthDay: number | null
  createdAt: Date
}

const WD_SHORT_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

/** 北京时间日历日 YYYY-MM-DD 在当天中午点下的 ISO 周几 1–7 */
export function isoWeekdayFromYmdShanghai(runYmd: string): number {
  const anchor = new Date(`${runYmd}T12:00:00+08:00`)
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  }).format(anchor)
  return WD_SHORT_TO_ISO[short.slice(0, 3)] ?? isoWeekday(anchor)
}

function monthDayFromYmd(runYmd: string): number {
  const d = parseInt(runYmd.slice(8, 10), 10)
  return Number.isFinite(d) ? d : 1
}

/** 北京时间 runYmd 日 + HH:mm → 绝对时刻（写入 DB 与判重一致） */
export function combineYmdAndTimeShanghai(runYmd: string, timeHHmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeHHmm.trim())
  if (!m) return new Date(`${runYmd}T12:00:00+08:00`)
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  const hh = String(h).padStart(2, '0')
  const mm = String(min).padStart(2, '0')
  return new Date(`${runYmd}T${hh}:${mm}:00+08:00`)
}

/**
 * 在「北京时间」runYmd（YYYY-MM-DD）当天应生成的任务时刻列表。
 * 与服务器所在时区无关，避免 UTC 机器上「周几 / 几号 / 时刻」错位导致不生成或判重异常。
 * 无 cycleSchedule 时沿用旧规则：命中则该日北京时间 0:00 一条。
 */
export function getScheduledDatetimesForRunDate(plan: PlanForSchedule, runYmd: string): Date[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runYmd)) return []

  const parsed = parseCycleSchedule(plan.cycleSchedule)
  const legacyRunDate = new Date(`${runYmd}T12:00:00+08:00`)

  if (parsed) {
    if (plan.cycleType === '每天' && parsed.kind === 'daily') {
      return parsed.slots.map((s) => combineYmdAndTimeShanghai(runYmd, s.time))
    }
    if (plan.cycleType === '每周' && parsed.kind === 'weekly') {
      const wd = isoWeekdayFromYmdShanghai(runYmd)
      return parsed.slots
        .filter((s) => s.weekday === wd)
        .map((s) => combineYmdAndTimeShanghai(runYmd, s.time))
    }
    if (plan.cycleType === '每月' && parsed.kind === 'monthly') {
      const dom = monthDayFromYmd(runYmd)
      return parsed.slots
        .filter((s) => s.monthDay === dom)
        .map((s) => combineYmdAndTimeShanghai(runYmd, s.time))
    }
    return []
  }

  const legacy: CyclePlanLike = {
    cycleType: plan.cycleType,
    cycleValue: plan.cycleValue,
    cycleWeekday: plan.cycleWeekday,
    cycleMonthDay: plan.cycleMonthDay,
    createdAt: plan.createdAt,
  }
  if (shouldGenerateOnDate(legacy, legacyRunDate)) {
    return [new Date(`${runYmd}T00:00:00+08:00`)]
  }
  return []
}

export function formatCycleScheduleSummary(
  cycleType: string,
  cycleValue: number,
  cycleSchedule: string | null
): string {
  const n = Math.max(1, cycleValue)
  const p = parseCycleSchedule(cycleSchedule)
  if (!p) {
    return cycleType === '每天'
      ? `每天（旧规则×${n}）`
      : `${cycleType}（旧规则×${n}）`
  }
  if (p.kind === 'daily') return `每天 ${n} 次`
  if (p.kind === 'weekly') return `每周 ${n} 次`
  if (p.kind === 'monthly') return `每月 ${n} 次`
  return cycleType
}
