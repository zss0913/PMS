import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 解析 YYYY-MM-DD，无效则返回 null */
function parseDateStart(s: string | null): Date | null {
  if (!s?.trim()) return null
  const t = s.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T00:00:00.000`)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseDateEnd(s: string | null): Date | null {
  if (!s?.trim()) return null
  const t = s.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T23:59:59.999`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 收据开具记录列表（分页） */
export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))
    const skip = (page - 1) * pageSize

    let from = parseDateStart(searchParams.get('issuedFrom'))
    let to = parseDateEnd(searchParams.get('issuedTo'))
    if (from && to && from.getTime() > to.getTime()) {
      const a = from
      const b = to
      from = new Date(`${b.toISOString().slice(0, 10)}T00:00:00.000`)
      to = new Date(`${a.toISOString().slice(0, 10)}T23:59:59.999`)
    }
    const tenantKeyword = searchParams.get('tenantKeyword')?.trim() ?? ''

    const where: Prisma.ReceiptIssueRecordWhereInput = {
      companyId: user.companyId,
      voidedAt: null,
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }
    if (tenantKeyword) {
      where.tenantName = { contains: tenantKeyword }
    }

    const delegate = prisma.receiptIssueRecord
    if (typeof delegate?.count !== 'function' || typeof delegate?.findMany !== 'function') {
      console.error(
        '[receipt-issue-records] prisma.receiptIssueRecord 不可用，请停止 dev 后执行 pnpm exec prisma generate 并重启'
      )
      return NextResponse.json({
        success: true,
        data: { list: [], total: 0, page, pageSize },
        notice: 'receipt_delegate_missing',
      })
    }

    let total: number
    let rows: Awaited<ReturnType<typeof delegate.findMany>>
    try {
      total = await delegate.count({ where })
      rows = await delegate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      })
    } catch (dbErr) {
      console.error('[receipt-issue-records] 查询失败（表未迁移或数据库异常）', dbErr)
      return NextResponse.json({
        success: true,
        data: { list: [], total: 0, page, pageSize },
        notice: 'receipt_query_failed',
      })
    }

    const list = rows.map((r) => ({
      id: r.id,
      batchId: r.batchId,
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      mergeMode: r.mergeMode as 'byTenant' | 'perBill',
      billCount: r.billCount,
      totalAmount: Number(r.totalAmount),
      billIdsJson: r.billIdsJson,
      billCodesJson: r.billCodesJson,
      lineAmountsJson: r.lineAmountsJson,
      templateId: r.templateId,
      operatorName: r.operatorName,
      operatorPhone: r.operatorPhone,
      createdAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: { list, total, page, pageSize },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '服务器错误' }, { status: 500 })
  }
}
