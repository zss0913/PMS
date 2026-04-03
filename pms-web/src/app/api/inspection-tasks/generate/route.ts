import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { writeInspectionTaskNotifications } from '@/lib/staff-notification-write'
import { shouldGenerateOnDate } from '@/lib/inspection-cycle'
import { parseCheckItemsJson } from '@/lib/inspection-check-items'

function genTaskCode() {
  return 'IT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * 按巡检计划周期，为「运行日」应生成的计划各创建一条任务（若该计划日尚无任务则创建）。
 * 默认运行日为当天，也可由 query ?date=YYYY-MM-DD 指定（便于补跑）。
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
    }
    if (user.companyId === 0) {
      return NextResponse.json(
        { success: false, message: '超级管理员请使用员工账号登录后操作' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')?.trim()
    const runDate = dateParam ? startOfDay(new Date(dateParam + 'T12:00:00')) : startOfDay(new Date())
    if (Number.isNaN(runDate.getTime())) {
      return NextResponse.json({ success: false, message: '日期参数无效' }, { status: 400 })
    }

    const plans = await prisma.inspectionPlan.findMany({
      where: { companyId: user.companyId, status: 'active' },
    })

    if (plans.length === 0) {
      return NextResponse.json({ success: false, message: '暂无启用的巡检计划' }, { status: 400 })
    }

    const dayStart = runDate
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    const created: string[] = []
    for (const plan of plans) {
      if (!plan.buildingId) continue
      const items = parseCheckItemsJson(plan.checkItems)
      if (items.length === 0) continue

      const hit = shouldGenerateOnDate(
        {
          cycleType: plan.cycleType,
          cycleValue: plan.cycleValue,
          cycleWeekday: plan.cycleWeekday,
          cycleMonthDay: plan.cycleMonthDay,
          createdAt: plan.createdAt,
        },
        runDate
      )
      if (!hit) continue

      const existing = await prisma.inspectionTask.findFirst({
        where: {
          planId: plan.id,
          companyId: user.companyId,
          scheduledDate: { gte: dayStart, lt: dayEnd },
        },
      })
      if (existing) continue

      let code = genTaskCode()
      while (await prisma.inspectionTask.findUnique({ where: { code } })) {
        code = genTaskCode()
      }

      const task = await prisma.inspectionTask.create({
        data: {
          code,
          planId: plan.id,
          planName: plan.name,
          inspectionType: plan.inspectionType,
          scheduledDate: dayStart,
          userIds: plan.userIds,
          route: plan.route,
          checkItems: plan.checkItems,
          buildingId: plan.buildingId,
          status: '待执行',
          companyId: user.companyId,
        },
      })
      await writeInspectionTaskNotifications(prisma, {
        companyId: user.companyId,
        taskId: task.id,
        planName: plan.name,
        taskCode: task.code,
        inspectionType: plan.inspectionType,
        planUserIds: plan.userIds,
      })
      created.push(plan.name)
    }

    return NextResponse.json({
      success: true,
      data: { created: created.length, plans: created, runDate: dayStart.toISOString() },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
