import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { buildBillWhereClause, filterBillsByPeriodOverlap } from '@/lib/bill-filters'
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
import { allocateUniqueReminderCode } from '@/lib/reminder-code'
import { insertTenantAppMessage } from '@/lib/tenant-app-message-db'

const bodySchema = z
  .object({
    templateId: z.number().int().positive().optional(),
    sendSms: z.boolean().default(false),
    sendApp: z.boolean().default(false),
    generatePaperWord: z.boolean().default(true),
    buildingId: z.union([z.string(), z.number()]).optional().nullable(),
    tenantId: z.union([z.string(), z.number()]).optional().nullable(),
    tenantKeyword: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    paymentStatus: z.string().optional().nullable(),
    overdue: z.string().optional().nullable(),
    feeType: z.string().optional().nullable(),
    feeTypeKeyword: z.string().optional().nullable(),
    dueDateStart: z.string().optional().nullable(),
    dueDateEnd: z.string().optional().nullable(),
    periodStart: z.string().optional().nullable(),
    periodEnd: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (!val.sendSms && !val.sendApp && !val.generatePaperWord) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请至少选择一种催缴方式',
        path: ['sendSms'],
      })
    }
    if (val.generatePaperWord && val.templateId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '生成纸质催缴单请选择催缴单模板',
        path: ['templateId'],
      })
    }
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

function buildReminderMethod(sendSms: boolean, sendApp: boolean, generatePaperWord: boolean): string {
  const parts: string[] = []
  if (sendSms) parts.push('短信')
  if (sendApp) parts.push('应用内')
  if (generatePaperWord) parts.push('纸质催缴单（Word）')
  return parts.join('、') || '催缴'
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

    let templateBuf: Buffer | null = null
    if (parsed.generatePaperWord) {
      const template = await prisma.printTemplate.findFirst({
        where: {
          id: parsed.templateId!,
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
      try {
        templateBuf = await readFile(templatePathFromUrl(template.templateUrl))
      } catch {
        return NextResponse.json({ success: false, message: '模板文件不存在，请重新上传' }, { status: 400 })
      }
      templateBuf = prepareDunningTemplateBillListAsRawTable(templateBuf)
    }

    const where = buildBillWhereClause(user.companyId, {
      buildingId: parsed.buildingId != null && parsed.buildingId !== '' ? String(parsed.buildingId) : null,
      tenantId: parsed.tenantId != null && parsed.tenantId !== '' ? String(parsed.tenantId) : null,
      tenantKeyword: parsed.tenantKeyword || null,
      status: parsed.status || null,
      paymentStatus: parsed.paymentStatus || null,
      overdue: parsed.overdue || null,
      feeType: parsed.feeType || null,
      feeTypeKeyword: parsed.feeTypeKeyword || null,
      dueDateStart: parsed.dueDateStart || null,
      dueDateEnd: parsed.dueDateEnd || null,
    })

    let bills = await prisma.bill.findMany({
      where,
      include: {
        tenant: { select: { id: true, companyName: true } },
        building: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, roomNumber: true } },
        account: { select: { bankName: true, accountNumber: true, accountHolder: true } },
      },
      orderBy: { id: 'asc' },
    })

    bills = filterBillsByPeriodOverlap(bills, parsed.periodStart, parsed.periodEnd)

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

    let merged: Buffer | null = null
    let filename: string | null = null

    if (parsed.generatePaperWord && templateBuf) {
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

      merged = await mergeDocxBuffers(filled)
      filename = `催缴单_${new Date().toISOString().slice(0, 10)}_${Date.now()}.docx`
    }

    let smsTargetCount = 0
    if (parsed.sendSms) {
      const adminRelations = await prisma.tenantUserRelation.findMany({
        where: {
          tenantId: { in: tenantIds },
          isAdmin: true,
        },
        include: {
          tenantUser: { select: { phone: true } },
          tenant: { select: { companyId: true } },
        },
      })
      const scoped = adminRelations.filter((r) => r.tenant.companyId === user.companyId)
      const phones = new Set(
        scoped.map((r) => r.tenantUser.phone.trim()).filter((p) => p.length > 0)
      )
      smsTargetCount = phones.size
      if (process.env.NODE_ENV !== 'production') {
        console.info(
          '[dunning-export] SMS targets (待对接短信网关):',
          [...phones].map((p) => p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'))
        )
      }
    }

    const methodLabel = buildReminderMethod(parsed.sendSms, parsed.sendApp, parsed.generatePaperWord)

    await prisma.$transaction(async (tx) => {
      const sortedTenants = [...tenantIds].sort((a, b) => a - b)
      for (const tenantId of sortedTenants) {
        const group = byTenant.get(tenantId)!
        const code = await allocateUniqueReminderCode(tx)
        await tx.paymentReminder.create({
          data: {
            code,
            billIds: JSON.stringify(group.map((b) => b.id)),
            method: methodLabel,
            content: null,
            notifyTargetId: 0,
            status: 'success',
            sentAt: new Date(),
            operatorId: user.id,
            companyId: user.companyId,
          },
        })
      }
      if (parsed.sendApp) {
        for (const tenantId of sortedTenants) {
          const group = byTenant.get(tenantId)!
          const totalDue = group.reduce((s, b) => s + Number(b.amountDue), 0)
          const billIds = group.map((b) => b.id)
          const lines = group
            .map((b) => `${b.code} 待缴 ¥${Number(b.amountDue).toFixed(2)}`)
            .join('\n')
          await insertTenantAppMessage(tx, {
            tenantId,
            companyId: user.companyId,
            title: '【账单催缴通知】',
            content: `尊敬的 ${group[0].tenant.companyName} 管理员：\n\n您有以下账单待缴，合计 ¥${totalDue.toFixed(2)}：\n${lines}`,
            billIdsJson: JSON.stringify(billIds),
          })
        }
      }
    })

    const op = authUserForLog(user)
    const metaJson = JSON.stringify({
      templateId: parsed.templateId ?? null,
      sendSms: parsed.sendSms,
      sendApp: parsed.sendApp,
      generatePaperWord: parsed.generatePaperWord,
    })
    await Promise.all(
      bills.map((b) =>
        insertBillActivityLog(prisma, {
          billId: b.id,
          billCode: b.code,
          companyId: user.companyId,
          action: BILL_ACTION.DUNNING_EXPORT,
          summary: `催缴通知（${methodLabel}）`,
          metaJson,
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          operatorPhone: op.operatorPhone,
        })
      )
    )

    return NextResponse.json({
      success: true,
      data: {
        paperWord:
          merged && filename
            ? {
                base64: Buffer.from(merged).toString('base64'),
                filename,
              }
            : null,
        sms: parsed.sendSms
          ? {
              targetCount: smsTargetCount,
              note: '已登记催缴；短信网关对接后将向租客管理员手机号发送',
            }
          : null,
        app: parsed.sendApp ? { messagesCreated: tenantIds.length } : null,
      },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      const first = e.errors[0]
      return NextResponse.json(
        {
          success: false,
          message: first?.message || '参数错误',
          errors: e.errors,
        },
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
