import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { generateInspectionTasksForCompany, getShanghaiYmd } from '@/lib/inspection-tasks-generate'

type GenerateBody = {
  date?: string
  /** 指定要生成的计划 ID；不传或空数组表示全部启用中的计划 */
  planIds?: number[]
}

/**
 * 按巡检计划周期，在「运行日」的各执行时刻创建任务（同一计划同一时刻不重复）。
 * Body JSON: { date?: "YYYY-MM-DD", planIds?: number[] }；仍支持 query ?date=。
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
    let body: GenerateBody = {}
    try {
      const ct = request.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        body = (await request.json()) as GenerateBody
      }
    } catch {
      /* ignore */
    }

    const dateParam = (typeof body.date === 'string' ? body.date : '').trim() || url.searchParams.get('date')?.trim()
    /** 留空运行日：按上海日历「今天」，与生成逻辑统一用 YYYY-MM-DD（北京时间） */
    const runYmd = dateParam
      ? dateParam
      : getShanghaiYmd()
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(runYmd)) {
      return NextResponse.json({ success: false, message: '日期参数无效' }, { status: 400 })
    }

    const rawIds = Array.isArray(body.planIds) ? body.planIds : []
    const planIdFilter = [...new Set(rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]

    const out = await generateInspectionTasksForCompany(prisma, {
      companyId: user.companyId,
      runYmd,
      planIdFilter: planIdFilter.length > 0 ? planIdFilter : undefined,
    })

    if (!out.ok) {
      return NextResponse.json({ success: false, message: out.message }, { status: 400 })
    }

    if (out.noActivePlans) {
      return NextResponse.json({ success: false, message: '暂无启用的巡检计划' }, { status: 400 })
    }

    const ymdFromInput =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null

    return NextResponse.json({
      success: true,
      data: {
        created: out.taskCount,
        taskCount: out.taskCount,
        plansTouched: out.plansTouched.length,
        plans: out.plansTouched,
        runDate: out.runDateIso,
        /** 与界面「运行日」一致的日历日（北京时间），勿用 runDate 的 ISO 字符串截断 */
        runDateYmd: ymdFromInput ?? out.runDateYmd,
        zeroTaskHints: out.zeroTaskHints,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
