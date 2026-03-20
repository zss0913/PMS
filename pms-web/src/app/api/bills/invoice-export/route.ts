import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { logBillActivity, BILL_ACTION, authUserForLog } from '@/lib/bill-activity-log'
import {
  emptyPlaceholderData,
  fillDocxTemplate,
  mergeDocxBuffers,
  type PrintPlaceholderData,
} from '@/lib/docx-templates'

const bodySchema = z.object({
  billIds: z.array(z.number().int().positive()).min(1, '请至少选择一条账单'),
  templateId: z.number().int().positive().optional(),
})

function templatePathFromUrl(url: string): string {
  const rel = url.startsWith('/') ? url.slice(1) : url
  return join(process.cwd(), 'public', rel)
}

function formatNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function POST(request: NextRequest) {
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

    const json = await request.json()
    const parsed = bodySchema.parse(json)

    const template = await prisma.printTemplate.findFirst({
      where: {
        companyId: user.companyId,
        status: 'active',
        type: '发票',
        ...(parsed.templateId ? { id: parsed.templateId } : {}),
      },
      orderBy: { id: 'desc' },
    })
    if (!template?.templateUrl) {
      return NextResponse.json(
        { success: false, message: '请先在「催缴打印模板管理」中上传发票 Word 模板' },
        { status: 400 }
      )
    }

    let templateBuf: Buffer
    try {
      templateBuf = await readFile(templatePathFromUrl(template.templateUrl))
    } catch {
      return NextResponse.json({ success: false, message: '模板文件不存在，请重新上传' }, { status: 400 })
    }

    const bills = await prisma.bill.findMany({
      where: {
        id: { in: parsed.billIds },
        companyId: user.companyId,
      },
      include: {
        tenant: { select: { id: true, companyName: true } },
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        account: { select: { bankName: true, accountNumber: true, accountHolder: true } },
      },
      orderBy: { id: 'asc' },
    })

    if (bills.length === 0) {
      return NextResponse.json({ success: false, message: '未找到有效账单' }, { status: 400 })
    }

    type Row = (typeof bills)[number] & { invoiceLineAmount: number }
    const withAmount: Row[] = []
    for (const b of bills) {
      const ar = Number(b.accountReceivable)
      const issued = Number(b.invoiceIssuedAmount ?? 0)
      const remain = ar - issued
      if (remain <= 0.0001) continue
      withAmount.push({ ...b, invoiceLineAmount: remain })
    }

    if (withAmount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '所选账单均已足额开具发票（账单应收已全部计入开票），无法再次生成',
        },
        { status: 400 }
      )
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    })

    const byTenant = new Map<number, Row[]>()
    for (const b of withAmount) {
      const arr = byTenant.get(b.tenantId) ?? []
      arr.push(b)
      byTenant.set(b.tenantId, arr)
    }

    const tenantIds = [...byTenant.keys()]
    const leaseRows = await prisma.tenantRoom.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, leaseArea: true },
    })
    const leaseSumByTenant = new Map<number, number>()
    for (const r of leaseRows) {
      const v = Number(r.leaseArea) || 0
      leaseSumByTenant.set(r.tenantId, (leaseSumByTenant.get(r.tenantId) ?? 0) + v)
    }

    const filled: Buffer[] = []

    for (const tenantId of tenantIds.sort((a, b) => a - b)) {
      const group = byTenant.get(tenantId)!
      const first = group[0]
      const acc = first.account

      const buildings = [
        ...new Set(group.map((b) => b.building?.name).filter((n): n is string => Boolean(n))),
      ]
      const rooms = [
        ...new Set(
          group
            .map((b) => (b.room ? b.room.roomNumber || b.room.name || '' : ''))
            .filter(Boolean)
        ),
      ]

      const billList = group
        .map(
          (b) =>
            `${b.code}　${b.feeType}　账期 ${b.period}　本次开票 ¥${b.invoiceLineAmount.toFixed(2)}`
        )
        .join('\n')

      const totalInvoice = group.reduce((s, b) => s + b.invoiceLineAmount, 0)

      const base = emptyPlaceholderData()
      const data: PrintPlaceholderData = {
        ...base,
        tenantName: first.tenant.companyName,
        buildingName: buildings.join('、'),
        leaseArea: (leaseSumByTenant.get(tenantId) ?? 0).toFixed(2),
        roomNumber: rooms.join('、'),
        billList,
        totalAmount: totalInvoice.toFixed(2),
        bankName: acc?.bankName ?? '',
        accountNumber: acc?.accountNumber ?? '',
        accountHolder: acc?.accountHolder ?? '',
        propertyName: company?.name ?? '',
        notifyTime: formatNow(),
      }

      filled.push(fillDocxTemplate(templateBuf, data))
    }

    const merged = await mergeDocxBuffers(filled)

    const op = authUserForLog(user)
    await prisma.$transaction(async (tx) => {
      for (const b of withAmount) {
        await tx.bill.update({
          where: { id: b.id },
          data: {
            invoiceIssuedAmount: { increment: new Decimal(b.invoiceLineAmount) },
          },
        })
        await logBillActivity(tx, {
          billId: b.id,
          billCode: b.code,
          companyId: user.companyId,
          action: BILL_ACTION.INVOICE_EXPORT,
          summary: '生成发票（导出 Word）',
          meta: {
            templateId: parsed.templateId ?? template.id,
            invoiceLineAmount: b.invoiceLineAmount,
          },
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          operatorPhone: op.operatorPhone,
        })
      }
    })

    const filename = `发票_${new Date().toISOString().slice(0, 10)}_${Date.now()}.docx`

    return new NextResponse(new Uint8Array(merged), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : '生成失败' },
      { status: 500 }
    )
  }
}
