import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchAutoRemindersForAllCompanies } from '@/lib/auto-reminder-dispatch'

/**
 * 定时任务：按各企业「自动催缴设置」在每月指定日、上海时区时间窗口内，
 * 对当前企业下所有逾期未结清账单按租客发送应用内通知（TenantAppMessage）。
 *
 * 部署时请配置 CRON_SECRET，并在调度器（如 Vercel Cron）中每 5 分钟请求一次，
 * Header: Authorization: Bearer <CRON_SECRET>
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
    const { parts, results } = await dispatchAutoRemindersForAllCompanies(prisma)
    const ran = results.filter((r) => !r.skipped)
    return NextResponse.json({
      success: true,
      data: {
        monthKey: parts.monthKey,
        chinaNow: parts,
        results,
        ranCount: ran.length,
      },
    })
  } catch (e) {
    console.error('[cron/auto-reminder]', e)
    return NextResponse.json(
      { success: false, message: '执行失败' },
      { status: 500 }
    )
  }
}
