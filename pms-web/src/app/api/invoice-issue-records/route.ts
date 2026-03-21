import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { enrichInvoiceLinesForRecords } from '@/lib/issue-record-lines'
import { prisma } from '@/lib/prisma'

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
    const rawSize = parseInt(searchParams.get('pageSize') ?? '15', 10)
    const pageSize = rawSize === 30 || rawSize === 100 ? rawSize : 15
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

    const where: Prisma.InvoiceIssueRecordWhereInput = {
      companyId: user.companyId,
      voidedAt: null,
      reversedAt: null,
    }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }
    if (tenantKeyword) {
      where.tenantName = { contains: tenantKeyword }
    }

    let total: number
    let rows: Awaited<ReturnType<typeof prisma.invoiceIssueRecord.findMany>>
    try {
      total = await prisma.invoiceIssueRecord.count({ where })
      rows = await prisma.invoiceIssueRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      })
    } catch (dbErr) {
      console.error('[invoice-issue-records] 查询失败', dbErr)
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      /** 常见情况：未执行 prisma generate，运行时 prisma.invoiceIssueRecord 为 undefined */
      const clientStale = msg.includes('Cannot read properties of undefined')
      return NextResponse.json({
        success: true,
        data: { list: [], total: 0, page, pageSize },
        notice: clientStale ? 'invoice_client_stale' : 'invoice_query_failed',
      })
    }

    const linesPerRecord = await enrichInvoiceLinesForRecords(
      rows.map((r) => r.lineAmountsJson),
      user.companyId
    )

    const list = rows.map((r, i) => ({
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
      lines: linesPerRecord[i] ?? [],
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
