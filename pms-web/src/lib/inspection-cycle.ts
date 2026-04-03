/**
 * 周期规则（与后台表单一致）：
 * - 每天：每 cycleValue 个自然日生成一次（从计划创建日起算第 0 天起每 N 天一次）
 * - 每周：在 cycleWeekday（1=周一…7=周日）生成；每 cycleValue 周一次（周序号从计划创建所在周锚定）
 * - 每月：在 cycleMonthDay（1-28）号生成；每 cycleValue 个月一次（从计划创建月锚定）
 */

export type CyclePlanLike = {
  cycleType: string
  cycleValue: number
  cycleWeekday: number | null
  cycleMonthDay: number | null
  createdAt: Date
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** JS getDay 0=周日 → ISO 1=周一..7=周日 */
export function isoWeekday(d: Date): number {
  const w = d.getDay()
  return w === 0 ? 7 : w
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime()
  return Math.floor(ms / 86400000)
}

function weekIndexUTC(d: Date): number {
  const t = startOfDay(d).getTime()
  return Math.floor(t / (7 * 86400000))
}

function monthsBetween(anchor: Date, d: Date): number {
  return (d.getFullYear() - anchor.getFullYear()) * 12 + (d.getMonth() - anchor.getMonth())
}

/**
 * 在给定「运行日」runDate（通常为今天），该计划是否应生成 scheduledDate=runDate 的任务
 */
export function shouldGenerateOnDate(plan: CyclePlanLike, runDate: Date): boolean {
  const today = startOfDay(runDate)
  const anchor = startOfDay(plan.createdAt)
  const N = Math.max(1, plan.cycleValue || 1)

  if (plan.cycleType === '每天') {
    const diff = daysBetween(today, anchor)
    if (diff < 0) return false
    return diff % N === 0
  }

  if (plan.cycleType === '每周') {
    const wd = plan.cycleWeekday ?? 1
    if (isoWeekday(today) !== wd) return false
    const w0 = weekIndexUTC(anchor)
    const w1 = weekIndexUTC(today)
    return (w1 - w0) % N === 0
  }

  if (plan.cycleType === '每月') {
    const dom = Math.min(28, Math.max(1, plan.cycleMonthDay ?? 1))
    if (today.getDate() !== dom) return false
    const m = monthsBetween(anchor, today)
    if (m < 0) return false
    return m % N === 0
  }

  return false
}
