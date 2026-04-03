import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { writeInspectionTaskNotifications } from '@/lib/staff-notification-write'

function genTaskCode() {
  return 'IT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}

/** 从巡检计划生成测试任务（每个启用计划生成今日任务） */
export async function POST() {
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

    const plans = await prisma.inspectionPlan.findMany({
      where: { companyId: user.companyId, status: 'active' },
    })

    if (plans.length === 0) {
      return NextResponse.json({ success: false, message: '暂无启用的巡检计划' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const created: string[] = []
    for (const plan of plans) {
      const existing = await prisma.inspectionTask.findFirst({
        where: {
          planId: plan.id,
          companyId: user.companyId,
          scheduledDate: { gte: today, lt: new Date(today.getTime() + 86400000) },
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
          scheduledDate: today,
          userIds: plan.userIds,
          route: plan.route,
          checkItems: plan.checkItems,
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
      data: { created: created.length, plans: created },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
