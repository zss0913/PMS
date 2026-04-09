import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  generateInspectionTasksForCompany,
  getShanghaiYmd,
  shanghaiMidnightIso,
} from '@/lib/inspection-tasks-generate'

/**
 * 定时任务：按上海日历「当天」为每个启用中的物业公司生成巡检任务；
 * 仅包含计划中「定时自动生成」为是的启用计划（与手动生成不同，手动可选任意启用计划）。
 * 部署：配置 CRON_SECRET；Vercel Cron 建议 schedule `0 4,10,16 * * *`（UTC）
 * → 北京时间每天 12:00、18:00、次日 0:00 各一次。
 * 请求头：Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && !secret) {
    return NextResponse.json(
      { success: false, message: '生产环境需配置 CRON_SECRET' },
      { status: 500 }
    )
  }
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, message: '未授权' }, { status: 401 })
    }
  }

  try {
    const ymd = getShanghaiYmd(new Date())

    const companies = await prisma.company.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })

    const perCompany: {
      companyId: number
      companyName: string
      taskCount: number
      plansTouched: number
      skippedNoPlans: boolean
      error?: string
    }[] = []

    let totalTasks = 0

    for (const c of companies) {
      try {
        const out = await generateInspectionTasksForCompany(prisma, {
          companyId: c.id,
          runYmd: ymd,
          onlyAutoGeneratePlans: true,
        })
        if (!out.ok) {
          perCompany.push({
            companyId: c.id,
            companyName: c.name,
            taskCount: 0,
            plansTouched: 0,
            skippedNoPlans: false,
            error: out.message,
          })
          continue
        }
        totalTasks += out.taskCount
        perCompany.push({
          companyId: c.id,
          companyName: c.name,
          taskCount: out.taskCount,
          plansTouched: out.plansTouched.length,
          skippedNoPlans: out.noActivePlans,
        })
      } catch (e) {
        console.error(`[cron/inspection-tasks-generate] company ${c.id}`, e)
        perCompany.push({
          companyId: c.id,
          companyName: c.name,
          taskCount: 0,
          plansTouched: 0,
          skippedNoPlans: false,
          error: e instanceof Error ? e.message : '执行失败',
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        shanghaiYmd: ymd,
        runDateIso: shanghaiMidnightIso(ymd),
        companyCount: companies.length,
        totalTasksCreated: totalTasks,
        results: perCompany,
      },
    })
  } catch (e) {
    console.error('[cron/inspection-tasks-generate]', e)
    return NextResponse.json({ success: false, message: '执行失败' }, { status: 500 })
  }
}
