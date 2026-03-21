import { randomUUID } from 'crypto'
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
  prepareDunningTemplateBillListAsRawTable,
  buildReceiptBillTableXml,
  type PrintPlaceholderData,
} from '@/lib/docx-templates'

const bodySchema = z.object({
  templateId: z.number().int().positive().optional(),
  /** byTenant：同一租客多账单合并为一张收据；perBill：每笔账单单独一张收据 */
  mergeMode: z.enum(['byTenant', 'perBill']).optional().default('byTenant'),
  /** 本次开具：每笔账单的本次收据金额（元）；打印与累计均用此值 */
  lines: z
    .array(
      z.object({
        billId: z.number().int().positive(),
        amount: z.number().positive('本次开具金额须大于 0'),
      })
    )
    .min(1, '请至少提交一条账单'),
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

function formatBillDueDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
    const mergeMode = parsed.mergeMode ?? 'byTenant'

    const billIds = [...new Set(parsed.lines.map((l) => l.billId))]
    if (billIds.length !== parsed.lines.length) {
      return NextResponse.json({ success: false, message: '同一账单不能重复提交' }, { status: 400 })
    }

    const template = await prisma.printTemplate.findFirst({
      where: {
        companyId: user.companyId,
        status: 'active',
        type: '收据',
        ...(parsed.templateId ? { id: parsed.templateId } : {}),
      },
      orderBy: { id: 'desc' },
    })
    if (!template?.templateUrl) {
      return NextResponse.json(
        { success: false, message: '请先在「催缴打印模板管理」中上传收据 Word 模板' },
        { status: 400 }
      )
    }

    let templateBuf: Buffer
    try {
      templateBuf = await readFile(templatePathFromUrl(template.templateUrl))
    } catch {
      return NextResponse.json({ success: false, message: '模板文件不存在，请重新上传' }, { status: 400 })
    }
    templateBuf = prepareDunningTemplateBillListAsRawTable(templateBuf)

    const bills = await prisma.bill.findMany({
      where: {
        id: { in: billIds },
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

    if (bills.length !== billIds.length) {
      return NextResponse.json({ success: false, message: '未找到有效账单' }, { status: 400 })
    }

    const billMap = new Map(bills.map((b) => [b.id, b]))
    type Row = (typeof bills)[number] & { receiptLineAmount: number }
    const withAmount: Row[] = []

    for (const line of parsed.lines) {
      const b = billMap.get(line.billId)
      if (!b) {
        return NextResponse.json({ success: false, message: `账单 id ${line.billId} 不存在` }, { status: 400 })
      }
      const ar = new Decimal(b.accountReceivable)
      const issued = new Decimal(b.receiptIssuedAmount ?? 0)
      const amt = new Decimal(line.amount)
      if (amt.lte(0)) {
        return NextResponse.json(
          { success: false, message: `账单 ${b.code}：本次开具金额须大于 0` },
          { status: 400 }
        )
      }
      if (issued.plus(amt).gt(ar)) {
        return NextResponse.json(
          {
            success: false,
            message: `账单 ${b.code}：本次开具金额与已开收据金额之和不能超过应收（应收 ¥${ar.toFixed(2)}，已开收据 ¥${issued.toFixed(2)}）`,
          },
          { status: 400 }
        )
      }
      withAmount.push({ ...b, receiptLineAmount: Number(amt.toFixed(2)) })
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

    /** 与 Word 中每一份收据一一对应：合并多账单为一条、不合并则一笔账单一条 */
    const receiptGroups: Row[][] =
      mergeMode === 'perBill'
        ? withAmount.map((b) => [b])
        : [...tenantIds].sort((a, b) => a - b).map((tid) => byTenant.get(tid)!)

    const batchId = randomUUID()

    const pushReceiptForGroup = (group: Row[]) => {
      if (group.length === 0) return
      const tenantId = group[0].tenantId
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

      const receiptTableXml = buildReceiptBillTableXml(
        group.map((b) => ({
          code: b.code,
          feeType: b.feeType,
          period: b.period,
          accountReceivable: Number(b.accountReceivable),
          amountPaid: Number(b.amountPaid ?? 0),
          receiptLineAmount: b.receiptLineAmount,
          dueDate: formatBillDueDate(b.dueDate),
        }))
      )

      const totalReceipt = group.reduce((s, b) => s + b.receiptLineAmount, 0)

      const base = emptyPlaceholderData()
      const data: PrintPlaceholderData = {
        ...base,
        tenantName: first.tenant.companyName,
        buildingName: buildings.join('、'),
        leaseArea: (leaseSumByTenant.get(tenantId) ?? 0).toFixed(2),
        roomNumber: rooms.join('、'),
        billList: receiptTableXml,
        billTableXml: receiptTableXml,
        totalAmount: totalReceipt.toFixed(2),
        bankName: acc?.bankName ?? '',
        accountNumber: acc?.accountNumber ?? '',
        accountHolder: acc?.accountHolder ?? '',
        propertyName: company?.name ?? '',
        notifyTime: formatNow(),
      }

      filled.push(fillDocxTemplate(templateBuf, data))
    }

    for (const group of receiptGroups) {
      pushReceiptForGroup(group)
    }

    const merged = await mergeDocxBuffers(filled)

    const op = authUserForLog(user)
    await prisma.$transaction(async (tx) => {
      for (const b of withAmount) {
        await tx.bill.update({
          where: { id: b.id },
          data: {
            receiptIssuedAmount: { increment: new Decimal(b.receiptLineAmount) },
          },
        })
        const issuedBefore = Number(b.receiptIssuedAmount ?? 0)
        const receiptIssuedTotalAfter = issuedBefore + b.receiptLineAmount
        await logBillActivity(tx, {
          billId: b.id,
          billCode: b.code,
          companyId: user.companyId,
          action: BILL_ACTION.RECEIPT_EXPORT,
          summary: '生成收据（导出 Word）',
          meta: {
            templateId: parsed.templateId ?? template.id,
            receiptLineAmount: b.receiptLineAmount,
            /** 本次操作后该账单已开收据累计（元） */
            receiptIssuedTotalAfter,
            mergeMode,
            batchId,
          },
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          operatorPhone: op.operatorPhone,
        })
      }
    })

    /** 收据记录写在事务外：交互式事务的 tx 在部分运行时下可能缺少新 model 的 delegate */
    try {
      await prisma.receiptIssueRecord.createMany({
        data: receiptGroups.map((group) => {
          const total = group.reduce((s, b) => s + b.receiptLineAmount, 0)
          return {
            companyId: user.companyId,
            batchId,
            tenantId: group[0].tenantId,
            tenantName: group[0].tenant.companyName,
            mergeMode,
            billCount: group.length,
            totalAmount: new Decimal(total.toFixed(2)),
            billIdsJson: JSON.stringify(group.map((b) => b.id)),
            billCodesJson: JSON.stringify(group.map((b) => b.code)),
            lineAmountsJson: JSON.stringify(
              group.map((b) => {
                const issuedBefore = Number(b.receiptIssuedAmount ?? 0)
                const receiptIssuedTotalAfter = Number(
                  (issuedBefore + b.receiptLineAmount).toFixed(2)
                )
                return {
                  billId: b.id,
                  code: b.code,
                  amount: b.receiptLineAmount,
                  accountReceivable: Number(b.accountReceivable),
                  amountPaid: Number(b.amountPaid ?? 0),
                  amountDue: Number(b.amountDue),
                  receiptIssuedTotalAfter,
                  feeType: b.feeType,
                  dueDate: b.dueDate.toISOString().slice(0, 10),
                }
              })
            ),
            templateId: template.id,
            operatorId: op.operatorId,
            operatorName: op.operatorName,
            operatorPhone: op.operatorPhone,
          }
        }),
      })
    } catch (e) {
      console.error('[receipt-export] 写入收据记录失败（账单已更新、仍可下载 Word）', e)
    }

    const filename = `收据_${new Date().toISOString().slice(0, 10)}_${Date.now()}.docx`

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
