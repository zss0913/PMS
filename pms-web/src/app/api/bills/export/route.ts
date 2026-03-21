import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildBillWhereClause, filterBillsByPeriodOverlap } from '@/lib/bill-filters'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'

function billSourceZh(s: string): string {
  if (s === 'manual') return '手工新建'
  if (s === 'rule') return '规则生成'
  return s
}

function statusZh(s: string): string {
  if (s === 'open') return '开启'
  if (s === 'closed') return '关闭'
  return s
}

function paymentStatusZh(s: string): string {
  const m: Record<string, string> = {
    unpaid: '未缴纳',
    partial: '部分缴纳',
    paid: '已结清',
  }
  return m[s] ?? s
}

function decStr(v: unknown): string {
  if (v == null) return ''
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : ''
}

function dt(v: Date): string {
  return v.toISOString().slice(0, 19).replace('T', ' ')
}

/** GET：与列表相同筛选条件，导出当前查询结果全部账单为 xlsx（字段明细） */
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

    const { searchParams } = new URL(request.url)
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')

    const where = buildBillWhereClause(user.companyId, {
      buildingId: searchParams.get('buildingId'),
      tenantId: searchParams.get('tenantId'),
      tenantKeyword: searchParams.get('tenantKeyword'),
      status: searchParams.get('status'),
      paymentStatus: searchParams.get('paymentStatus'),
      overdue: searchParams.get('overdue'),
      feeType: searchParams.get('feeType'),
      feeTypeKeyword: searchParams.get('feeTypeKeyword'),
      dueDateStart: searchParams.get('dueDateStart'),
      dueDateEnd: searchParams.get('dueDateEnd'),
    })

    let bills = await prisma.bill.findMany({
      where,
      include: {
        tenant: { select: { id: true, companyName: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        building: { select: { id: true, name: true } },
        account: {
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            accountHolder: true,
          },
        },
        rule: { select: { id: true, code: true, name: true } },
      },
      orderBy: { id: 'desc' },
    })

    bills = filterBillsByPeriodOverlap(bills, periodStart, periodEnd)

    const projectIds = [
      ...new Set(
        bills.map((b) => b.projectId).filter((x): x is number => x != null && x > 0)
      ),
    ]
    const projects =
      projectIds.length > 0
        ? await prisma.project.findMany({
            where: { companyId: user.companyId, id: { in: projectIds } },
            select: { id: true, name: true },
          })
        : []
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]))

    const headers = [
      '账单ID',
      '账单编号',
      '账单来源',
      '规则ID',
      '规则编号',
      '规则名称(快照)',
      '规则名称(关联)',
      '项目ID',
      '项目名称',
      '租客ID',
      '租客名称',
      '楼宇ID',
      '楼宇名称',
      '房源ID',
      '房源房号',
      '房源名称',
      '房源展示(含合并)',
      '费用类型',
      '账期',
      '应收金额',
      '已缴纳金额',
      '未缴纳金额',
      '已开收据累计',
      '已开票累计',
      '账单状态',
      '结清状态',
      '应收日期',
      '收款账户ID',
      '开户行',
      '银行账号',
      '账户户名',
      '备注',
      '总量',
      '单价',
      '创建时间',
      '更新时间',
      '公司ID',
    ]

    const rows: (string | number)[][] = bills.map((b) => {
      const roomsDisplay = formatBillRoomsDisplay(b.remark, b.room)
      const roomNumber = b.room?.roomNumber ?? b.room?.name ?? ''
      const roomName = b.room?.name ?? ''
      const pid = b.projectId
      return [
        b.id,
        b.code,
        billSourceZh(b.billSource),
        b.ruleId ?? '',
        b.rule?.code ?? '',
        b.ruleName,
        b.rule?.name ?? '',
        pid ?? '',
        pid ? (projectNameById.get(pid) ?? '') : '',
        b.tenantId,
        b.tenant.companyName,
        b.buildingId ?? '',
        b.building?.name ?? '',
        b.roomId ?? '',
        roomNumber,
        roomName,
        roomsDisplay,
        b.feeType,
        b.period,
        decStr(b.accountReceivable),
        decStr(b.amountPaid),
        decStr(b.amountDue),
        decStr(b.receiptIssuedAmount),
        decStr(b.invoiceIssuedAmount),
        statusZh(b.status),
        paymentStatusZh(b.paymentStatus),
        b.dueDate.toISOString().slice(0, 10),
        b.accountId,
        b.account?.bankName ?? '',
        b.account?.accountNumber ?? '',
        b.account?.accountHolder ?? '',
        b.remark ?? '',
        b.quantityTotal != null ? decStr(b.quantityTotal) : '',
        b.unitPrice != null ? decStr(b.unitPrice) : '',
        dt(b.createdAt),
        dt(b.updatedAt),
        b.companyId,
      ]
    })

    const aoa = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '账单明细')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const fname = `账单导出_${new Date().toISOString().slice(0, 10)}_${Date.now()}.xlsx`
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, message: '导出失败' }, { status: 500 })
  }
}
