import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'
import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { logBillActivity, BILL_ACTION, authUserForLog } from '@/lib/bill-activity-log'
import { resolveManualBillLocationFromTenant } from '@/lib/manual-bill-building-room'

const manualSchema = z.object({
  tenantId: z.number().int().positive('请选择租客'),
  feeType: z.string().min(1, '请填写费用类型').max(100),
  period: z.string().min(1, '请填写账期').max(500),
  accountReceivable: z.number().positive('应收金额须大于 0'),
  dueDate: z.string().min(1, '请选择应收日期'),
  remark: z.string().max(2000).optional(),
  quantityTotal: z.number().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  accountId: z.number().int().positive('请选择收款账户'),
})

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

    const body = await request.json()
    const parsed = manualSchema.parse(body)

    const tenant = await prisma.tenant.findFirst({
      where: { id: parsed.tenantId, companyId: user.companyId },
    })
    if (!tenant) {
      return NextResponse.json({ success: false, message: '租客不存在或不属于当前公司' }, { status: 400 })
    }

    const account = await prisma.account.findFirst({
      where: { id: parsed.accountId, companyId: user.companyId },
    })
    if (!account) {
      return NextResponse.json({ success: false, message: '收款账户不存在' }, { status: 400 })
    }

    const dueDate = new Date(parsed.dueDate)
    if (Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ success: false, message: '应收日期无效' }, { status: 400 })
    }

    const ar = Math.round(parsed.accountReceivable * 100) / 100
    const qty =
      parsed.quantityTotal != null && !Number.isNaN(parsed.quantityTotal)
        ? new Decimal(Math.round(parsed.quantityTotal * 1e6) / 1e6)
        : null
    const up =
      parsed.unitPrice != null && !Number.isNaN(parsed.unitPrice)
        ? new Decimal(Math.round(parsed.unitPrice * 100) / 100)
        : null

    const existingBillCount = await prisma.bill.count({ where: { companyId: user.companyId } })
    let baseNum = existingBillCount + 1
    let code = ''
    let exists = true
    while (exists) {
      code = `BILL${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(baseNum).padStart(4, '0')}`
      const existsBill = await prisma.bill.findUnique({ where: { code } })
      exists = !!existsBill
      if (exists) baseNum++
    }

    const { buildingId, roomId, projectId, remark: resolvedRemark } =
      await resolveManualBillLocationFromTenant(
        prisma,
        user.companyId,
        parsed.tenantId,
        parsed.remark
      )

    const bill = await prisma.bill.create({
      data: {
        code,
        ruleId: null,
        ruleName: '手工账单',
        projectId,
        buildingId,
        roomId,
        tenantId: parsed.tenantId,
        feeType: parsed.feeType.trim(),
        period: parsed.period.trim(),
        accountReceivable: new Decimal(ar),
        amountPaid: new Decimal(0),
        amountDue: new Decimal(ar),
        status: 'open',
        paymentStatus: 'unpaid',
        dueDate,
        accountId: parsed.accountId,
        remark: resolvedRemark,
        companyId: user.companyId,
        quantityTotal: qty,
        unitPrice: up,
        billSource: 'manual',
      },
    })

    const op = authUserForLog(user)
    try {
      await logBillActivity(prisma, {
        billId: bill.id,
        billCode: bill.code,
        companyId: user.companyId,
        action: BILL_ACTION.CREATE,
        summary: '手工创建账单',
        operatorId: op.operatorId,
        operatorName: op.operatorName,
        operatorPhone: op.operatorPhone,
      })
    } catch (logErr) {
      console.error('[bills/manual] 账单已创建，操作日志写入失败', logErr)
    }

    return NextResponse.json({
      success: true,
      data: { id: bill.id, code: bill.code },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: e.errors[0]?.message ?? '参数错误', errors: e.errors },
        { status: 400 }
      )
    }
    console.error(e)
    let message = '服务器错误'
    if (e instanceof PrismaClientKnownRequestError) {
      if (e.code === 'P2022' || e.message.includes('does not exist')) {
        message =
          '数据库表结构未更新：请在项目目录执行 npx prisma db push（或迁移）后重启服务'
      } else {
        message = `数据库错误（${e.code}）：${e.meta ? JSON.stringify(e.meta) : e.message}`
      }
    } else if (e instanceof Error && e.message) {
      message = e.message
      if (/Unknown arg|Unknown field|Invalid `prisma\.bill\.create`/i.test(message)) {
        message =
          'Prisma 客户端与库表不一致：请关闭杀毒/占用后执行 npx prisma generate，必要时 npx prisma db push，并重启 dev 服务'
      }
    }
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
