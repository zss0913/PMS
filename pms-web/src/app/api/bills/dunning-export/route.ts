import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { buildBillWhereClause } from '@/lib/bill-filters'
import { collectRoomIdsForBillGroup } from '@/lib/bill-room-resolve'
import { BILL_ACTION, authUserForLog } from '@/lib/bill-activity-log'
import { insertBillActivityLog } from '@/lib/bill-activity-log-db'
import {
  buildBillTableXml,
  emptyPlaceholderData,
  fillDocxTemplate,
  mergeDocxBuffers,
  prepareDunningTemplateBillListAsRawTable,
  type PrintPlaceholderData,
} from '@/lib/docx-templates'

const bodySchema = z.object({
  templateId: z.number().int().positive('请选择催缴单模板'),
  buildingId: z.union([z.string(), z.number()]).optional().nullable(),
  tenantId: z.union([z.string(), z.number()]).optional().nullable(),
  status: z.string().optional().nullable(),
  paymentStatus: z.string().optional().nullable(),
  overdue: z.string().optional().nullable(),
  feeType: z.string().optional().nullable(),
  dueDateStart: z.string().optional().nullable(),
  dueDateEnd: z.string().optional().nullable(),
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

    const template = await prisma.printTemplate.findFirst({
      where: {
        id: parsed.templateId,
        companyId: user.companyId,
        status: 'active',
        type: '催缴单',
      },
    })
    if (!template?.templateUrl) {
      return NextResponse.json(
        { success: false, message: '模板不存在或未上传 Word 文件' },
        { status: 400 }
      )
    }

    let templateBuf: Buffer
    try {
      templateBuf = await readFile(templatePathFromUrl(template.templateUrl))
    } catch {
      return NextResponse.json({ success: false, message: '模板文件不存在，请重新上传' }, { status: 400 })
    }
    /** `{{billList}}` 改为 RawXml，才能插入 Word 表格（否则只是一段文本） */
    templateBuf = prepareDunningTemplateBillListAsRawTable(templateBuf)

    const where = buildBillWhereClause(user.companyId, {
      buildingId: parsed.buildingId != null && parsed.buildingId !== '' ? String(parsed.buildingId) : null,
      tenantId: parsed.tenantId != null && parsed.tenantId !== '' ? String(parsed.tenantId) : null,
      status: parsed.status || null,
      paymentStatus: parsed.paymentStatus || null,
      overdue: parsed.overdue || null,
      feeType: parsed.feeType || null,
      dueDateStart: parsed.dueDateStart || null,
      dueDateEnd: parsed.dueDateEnd || null,
    })

    const bills = await prisma.bill.findMany({
      where,
      include: {
        tenant: { select: { id: true, companyName: true } },
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        account: { select: { bankName: true, accountNumber: true, accountHolder: true } },
      },
      orderBy: { id: 'asc' },
    })

    if (bills.length === 0) {
      return NextResponse.json(
        { success: false, message: '当前筛选条件下没有符合条件的账单' },
        { status: 400 }
      )
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    })

    const byTenant = new Map<number, typeof bills>()
    for (const b of bills) {
      const arr = byTenant.get(b.tenantId) ?? []
      arr.push(b)
      byTenant.set(b.tenantId, arr)
    }

    const tenantIds = [...byTenant.keys()]
    /** 按「租客 + 房源」维度的租赁面积；催缴单只汇总本单涉及房源，不用租客下全部房源合计 */
    const leaseRows = await prisma.tenantRoom.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { tenantId: true, roomId: true, leaseArea: true },
    })
    const leaseByTenantRoom = new Map<string, number>()
    for (const r of leaseRows) {
      leaseByTenantRoom.set(`${r.tenantId}:${r.roomId}`, Number(r.leaseArea) || 0)
    }

    const filled: Buffer[] = []

    for (const tenantId of tenantIds.sort((a, b) => a - b)) {
      const group = byTenant.get(tenantId)!
      const first = group[0]
      const acc = first.account

      const buildings = [
        ...new Set(group.map((b) => b.building?.name).filter((n): n is string => Boolean(n))),
      ]
      const physical = group.filter(
        (b): b is typeof b & { buildingId: number; roomId: number } =>
          b.buildingId != null && b.roomId != null
      )
      const roomIdsInNotice =
        physical.length > 0 ? await collectRoomIdsForBillGroup(prisma, physical, user.companyId) : []
      let leaseAreaForNotice = 0
      for (const rid of roomIdsInNotice) {
        leaseAreaForNotice += leaseByTenantRoom.get(`${tenantId}:${rid}`) ?? 0
      }
      const roomMeta = await prisma.room.findMany({
        where: { id: { in: roomIdsInNotice } },
        select: { id: true, roomNumber: true, name: true },
      })
      const labelById = new Map(
        roomMeta.map((r) => [r.id, (r.roomNumber || r.name || '').trim()])
      )
      const rooms = roomIdsInNotice.map((rid) => labelById.get(rid)).filter((s): s is string => Boolean(s))

      const billTableXml = buildBillTableXml(
        group.map((b) => ({
          code: b.code,
          feeType: b.feeType,
          period: b.period,
          accountReceivable: Number(b.accountReceivable),
          amountPaid: Number(b.amountPaid),
          amountDue: Number(b.amountDue),
          dueDate: formatBillDueDate(b.dueDate),
        }))
      )

      const totalDue = group.reduce((s, b) => s + Number(b.amountDue), 0)

      const base = emptyPlaceholderData()
      const data: PrintPlaceholderData = {
        ...base,
        tenantName: first.tenant.companyName,
        buildingName: buildings.join('、'),
        leaseArea: leaseAreaForNotice.toFixed(2),
        roomNumber: rooms.join('、'),
        billList: billTableXml,
        billTableXml,
        totalAmount: totalDue.toFixed(2),
        bankName: acc?.bankName ?? '',
        accountNumber: acc?.accountNumber ?? '',
        accountHolder: acc?.accountHolder ?? '',
        propertyName: company?.name ?? '',
        notifyTime: formatNow(),
      }

      filled.push(fillDocxTemplate(templateBuf, data))
    }

    const merged = await mergeDocxBuffers(filled)
    const filename = `催缴单_${new Date().toISOString().slice(0, 10)}_${Date.now()}.docx`

    const op = authUserForLog(user)
    const metaJson = JSON.stringify({ templateId: parsed.templateId })
    await Promise.all(
      bills.map((b) =>
        insertBillActivityLog(prisma, {
          billId: b.id,
          billCode: b.code,
          companyId: user.companyId,
          action: BILL_ACTION.DUNNING_EXPORT,
          summary: '生成催缴单（导出 Word）',
          metaJson,
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          operatorPhone: op.operatorPhone,
        })
      )
    )

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
