import type { PrismaClient } from '@prisma/client'
import { writeInspectionTaskNotifications } from '@/lib/staff-notification-write'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'
import {
  getScheduledDatetimesForRunDate,
  isoWeekdayFromYmdShanghai,
  parseCycleSchedule,
} from '@/lib/inspection-cycle-schedule'

export function genInspectionTaskCode() {
  return 'IT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

/** 当前时刻在 Asia/Shanghai 下的日历日期 YYYY-MM-DD */
export function getShanghaiYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) throw new Error('无法解析上海时区日期')
  return `${y}-${m}-${d}`
}

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 说明为何本计划在 runDate 当天没有新任务（未创建或全已存在） */
function explainPlanSkipped(
  plan: {
    name: string
    buildingId: number | null
    cycleType: string
    cycleValue: number
    cycleSchedule: string | null
  },
  runYmd: string,
  datetimes: Date[],
  createdCountForPlan: number,
  itemsCount: number
): string | null {
  const ymd = runYmd
  if (!plan.buildingId) {
    return `「${plan.name}」未绑定楼宇，无法生成。`
  }
  if (itemsCount === 0) {
    return `「${plan.name}」无检查项，请先在巡检计划中配置巡检点路线。`
  }
  if (datetimes.length === 0) {
    const parsed = parseCycleSchedule(plan.cycleSchedule)
    if (parsed && plan.cycleType === '每周' && parsed.kind === 'weekly') {
      const wd = isoWeekdayFromYmdShanghai(runYmd)
      return `「${plan.name}」为每周计划：${ymd}（北京时间）是${WEEKDAY_LABELS[wd - 1]}，与计划中设定的执行周几不一致，故当日不生成任务。请换到计划里配置的「周几」对应日期再生成，或调整计划。`
    }
    if (parsed && plan.cycleType === '每月' && parsed.kind === 'monthly') {
      return `「${plan.name}」为每月计划：${ymd} 的「几号」与计划中配置的每月执行日不一致，故当日不生成。请换到对应日期或调整计划。`
    }
    if (plan.cycleType === '每天' && parsed?.kind === 'daily') {
      return `「${plan.name}」为每天计划但未得到有效执行时刻，请打开计划检查「周期执行时刻」是否完整（须与「周期值」次数一致）。`
    }
    if (!parsed && plan.cycleType === '每天') {
      const n = Math.max(1, plan.cycleValue || 1)
      return `「${plan.name}」使用旧版「每 ${n} 天一次」规则：${ymd} 不是生成日（从计划创建日起每隔 ${n} 天才会生成）。建议在巡检计划中改为新版「每天 + 多个时刻」配置，即可在任意日期生成当日各次任务。`
    }
    if (!parsed && plan.cycleType === '每周') {
      return `「${plan.name}」为旧版每周规则：${ymd} 未命中「创建周锚定 + 周几」条件。请改用新版「每周 + 各次周几与时刻」，或换到符合旧规则的日期。`
    }
    if (!parsed && plan.cycleType === '每月') {
      return `「${plan.name}」为旧版每月规则：${ymd} 未命中生成条件。请改用新版「每月 + 各次日期与时刻」。`
    }
    if (
      parsed &&
      plan.cycleType !==
        (parsed.kind === 'daily' ? '每天' : parsed.kind === 'weekly' ? '每周' : '每月')
    ) {
      return `「${plan.name}」的周期类型与「周期执行时刻」表不一致，无法计算当日任务，请重新编辑计划并保存。`
    }
    return `「${plan.name}」在所选运行日 ${ymd} 没有应生成的时刻。`
  }
  if (createdCountForPlan === 0) {
    return `「${plan.name}」在 ${ymd}（北京时间）应生成的各时刻任务在数据库中均已存在，系统未重复创建。若下方任务列表为空，通常是因为页面上方「状态 / 楼宇 / 计划日期起止」筛选把任务隐藏了，请清空这些筛选后再查看。`
  }
  return null
}

export type GenerateInspectionTasksOutcome =
  | {
      ok: true
      taskCount: number
      plansTouched: string[]
      runDateIso: string
      /** 运行日 YYYY-MM-DD（北京时间日历，勿用 runDateIso.slice(0,10)） */
      runDateYmd: string
      noActivePlans: boolean
      /** taskCount 为 0 时便于用户理解原因 */
      zeroTaskHints?: string[]
    }
  | {
      ok: false
      code: 'invalid_plan_filter'
      message: string
    }

/** 北京时间某日 0 点对应的 UTC 时刻（用于 runDateIso） */
export function shanghaiMidnightIso(runYmd: string): string {
  return new Date(`${runYmd}T00:00:00+08:00`).toISOString()
}

/**
 * 按巡检计划在「北京时间」runYmd 当天生成任务（与 POST /api/inspection-tasks/generate 同源逻辑）。
 */
export async function generateInspectionTasksForCompany(
  db: PrismaClient,
  opts: {
    companyId: number
    /** 运行日 YYYY-MM-DD（北京时间日历，与界面一致） */
    runYmd: string
    planIdFilter?: number[]
    /**
     * 为 true 时仅处理计划中「允许定时自动生成」的项（Cron 用）。
     * 手动生成不传或 false，包含所有启用中的计划（或 planIdFilter 指定子集）。
     */
    onlyAutoGeneratePlans?: boolean
  }
): Promise<GenerateInspectionTasksOutcome> {
  const { companyId, planIdFilter = [], onlyAutoGeneratePlans = false } = opts
  const runYmd = opts.runYmd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runYmd)) {
    return {
      ok: false,
      code: 'invalid_plan_filter',
      message: '运行日无效',
    }
  }

  const plans = await db.inspectionPlan.findMany({
    where: {
      companyId,
      status: { in: ['active', '启用'] },
      ...(onlyAutoGeneratePlans ? { autoGenerateTasks: true } : {}),
      ...(planIdFilter.length > 0 ? { id: { in: planIdFilter } } : {}),
    },
  })

  if (planIdFilter.length > 0) {
    const found = new Set(plans.map((p) => p.id))
    const missing = planIdFilter.filter((id) => !found.has(id))
    if (missing.length > 0) {
      return {
        ok: false,
        code: 'invalid_plan_filter',
        message: '部分所选计划不存在、已停用或无权访问',
      }
    }
  }

  if (plans.length === 0) {
    return {
      ok: true,
      taskCount: 0,
      plansTouched: [],
      runDateIso: shanghaiMidnightIso(runYmd),
      runDateYmd: runYmd,
      noActivePlans: true,
    }
  }

  const createdNames: string[] = []
  const zeroHints: string[] = []
  let taskCount = 0

  for (const plan of plans) {
    const items = parseCheckItemsJson(plan.checkItems)
    const datetimes = getScheduledDatetimesForRunDate(
      {
        cycleType: plan.cycleType,
        cycleValue: plan.cycleValue,
        cycleSchedule: plan.cycleSchedule,
        cycleWeekday: plan.cycleWeekday,
        cycleMonthDay: plan.cycleMonthDay,
        createdAt: plan.createdAt,
      },
      runYmd
    )

    let createdForPlan = 0
    if (plan.buildingId && items.length > 0) {
      for (const scheduledDate of datetimes) {
        const existing = await db.inspectionTask.findFirst({
          where: {
            planId: plan.id,
            companyId,
            scheduledDate,
          },
        })
        if (existing) continue

        let code = genInspectionTaskCode()
        while (await db.inspectionTask.findUnique({ where: { code } })) {
          code = genInspectionTaskCode()
        }

        const task = await db.inspectionTask.create({
          data: {
            code,
            planId: plan.id,
            planName: plan.name,
            inspectionType: plan.inspectionType,
            scheduledDate,
            requirePhoto: plan.requirePhoto,
            userIds: plan.userIds,
            route: plan.route,
            checkItems: plan.checkItems,
            buildingId: plan.buildingId,
            status: '待执行',
            companyId,
          },
        })
        createdForPlan += 1
        taskCount += 1
        await writeInspectionTaskNotifications(db, {
          companyId,
          taskId: task.id,
          planName: plan.name,
          taskCode: task.code,
          inspectionType: plan.inspectionType,
          planUserIds: plan.userIds,
        })
        if (!createdNames.includes(plan.name)) createdNames.push(plan.name)
      }
    }

    const hint = explainPlanSkipped(
      {
        name: plan.name,
        buildingId: plan.buildingId,
        cycleType: plan.cycleType,
        cycleValue: plan.cycleValue,
        cycleSchedule: plan.cycleSchedule,
      },
      runYmd,
      datetimes,
      createdForPlan,
      items.length
    )
    if (hint) zeroHints.push(hint)
  }

  return {
    ok: true,
    taskCount,
    plansTouched: createdNames,
    runDateIso: shanghaiMidnightIso(runYmd),
    runDateYmd: runYmd,
    noActivePlans: false,
    zeroTaskHints:
      taskCount === 0
        ? zeroHints.length > 0
          ? zeroHints
          : ['当前运行日下没有可生成的新任务，请检查计划周期、执行日或是否已全部存在。']
        : undefined,
  }
}
