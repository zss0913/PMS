import type { Prisma, PrismaClient } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import {
  logBillActivity,
  BILL_ACTION,
  formatMoneyYuan,
  paymentStatusZh,
} from '@/lib/bill-activity-log'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

type Db = PrismaClient | Prisma.TransactionClient

export const WORK_ORDER_FEE_PAY_METHOD_WECHAT = '微信支付' as const
export const WORK_ORDER_FEE_PAY_METHOD_ALIPAY = '支付宝支付' as const

export function channelToPaymentMethod(channel: 'wechat' | 'alipay'): string {
  return channel === 'wechat' ? WORK_ORDER_FEE_PAY_METHOD_WECHAT : WORK_ORDER_FEE_PAY_METHOD_ALIPAY
}

export function feeTypeFromWorkOrderType(type: string): string {
  const t = type.trim()
  if (t === '报修') return '报修'
  return '报事'
}

export function buildWorkOrderFeeBillRemark(wo: {
  code: string
  title: string
  description: string
}): string {
  const title = wo.title.trim() || '（无标题）'
  const desc = wo.description.trim() || '（无描述）'
  const raw = `工单 ${wo.code}｜${title}\n问题描述：${desc}`
  return raw.length > 3800 ? `${raw.slice(0, 3797)}…` : raw
}

function todayPeriodYmd(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function dueDateEndOfDay(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999Z`)
}

async function allocateUniquePaymentCode(tx: Prisma.TransactionClient): Promise<string> {
  const dayPrefix = `PAY${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  let n = (await tx.payment.count()) + 1
  let attempts = 0
  while (attempts < 50000) {
    const code = `${dayPrefix}${String(n).padStart(4, '0')}`
    const exists = await tx.payment.findUnique({ where: { code } })
    if (!exists) return code
    n++
    attempts++
  }
  throw new Error('无法生成唯一缴费单号，请稍后重试')
}

function resolveBillTenantId(
  wo: { tenantId: number | null },
  tenantIds: number[]
): number | null {
  if (wo.tenantId != null) return wo.tenantId
  if (tenantIds.length === 1) return tenantIds[0]
  if (tenantIds.length > 0) return tenantIds[0]
  return null
}

async function allocateUniqueBillCode(tx: Prisma.TransactionClient): Promise<string> {
  let baseNum = (await tx.bill.count()) + 1
  let exists = true
  let code = ''
  while (exists) {
    code = `BILL${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(baseNum).padStart(4, '0')}`
    const existsBill = await tx.bill.findUnique({ where: { code } })
    exists = !!existsBill
    if (exists) baseNum++
  }
  return code
}

export async function getOrCreateWorkOrderFeeBill(
  db: PrismaClient,
  input: {
    workOrderId: number
    companyId: number
    tenantIds: number[]
    tenantUserId: number
    operator: ReturnType<typeof operatorFromAuthUser>
  }
): Promise<
  | { ok: true; bill: { id: number; code: string }; created: boolean }
  | { ok: false; message: string; status: number }
> {
  const wo = await db.workOrder.findFirst({
    where: {
      id: input.workOrderId,
      companyId: input.companyId,
      status: '待租客确认费用',
      OR: [{ tenantId: { in: input.tenantIds } }, { reporterId: input.tenantUserId }],
    },
  })
  if (!wo) {
    return { ok: false, message: '工单不存在或当前不可生成费用账单', status: 404 }
  }

  const billTenantId = resolveBillTenantId(wo, input.tenantIds)
  if (billTenantId == null) {
    return { ok: false, message: '无法确定账单所属租客，请联系物业', status: 400 }
  }

  const feeTotal = wo.feeTotal != null && Number.isFinite(wo.feeTotal) ? Number(wo.feeTotal) : NaN
  if (!Number.isFinite(feeTotal) || feeTotal <= 0) {
    return { ok: false, message: '工单费用合计无效，无法生成账单', status: 400 }
  }

  const existing = await db.bill.findFirst({
    where: {
      companyId: input.companyId,
      workOrderId: input.workOrderId,
      billSource: 'work_order_fee',
    },
    orderBy: { id: 'desc' },
  })

  if (existing) {
    const ar = Number(existing.accountReceivable)
    if (Math.abs(ar - feeTotal) > 0.02) {
      return {
        ok: false,
        message: '已存在关联账单但金额与当前工单费用不一致，请联系物业处理',
        status: 409,
      }
    }
    return { ok: true, bill: { id: existing.id, code: existing.code }, created: false }
  }

  const account = await db.account.findFirst({
    where: { companyId: input.companyId },
    orderBy: { id: 'asc' },
  })
  if (!account) {
    return { ok: false, message: '企业尚未配置收款账户，无法生成账单', status: 503 }
  }

  const period = todayPeriodYmd()
  const dueDate = dueDateEndOfDay(period)
  const feeType = feeTypeFromWorkOrderType(wo.type)
  const remark = buildWorkOrderFeeBillRemark(wo)

  try {
    const bill = await db.$transaction(async (tx) => {
      const code = await allocateUniqueBillCode(tx)
      return tx.bill.create({
        data: {
          code,
          ruleId: null,
          ruleName: '工单费用',
          projectId: wo.projectId,
          buildingId: wo.buildingId,
          roomId: wo.roomId,
          tenantId: billTenantId,
          feeType,
          period,
          accountReceivable: new Decimal(feeTotal),
          amountPaid: new Decimal(0),
          amountDue: new Decimal(feeTotal),
          status: 'open',
          paymentStatus: 'unpaid',
          dueDate,
          accountId: account.id,
          remark,
          companyId: input.companyId,
          billSource: 'work_order_fee',
          workOrderId: input.workOrderId,
        },
      })
    })

    try {
      await logBillActivity(db, {
        billId: bill.id,
        billCode: bill.code,
        companyId: input.companyId,
        action: BILL_ACTION.CREATE,
        summary: `工单费用账单自动生成（工单 ${wo.code}）`,
        operatorId: input.operator.operatorId ?? 0,
        operatorName: input.operator.operatorName ?? '系统',
        operatorPhone: input.operator.operatorPhone ?? '',
      })
    } catch (e) {
      console.error('[work-order-fee-bill] 账单已创建，操作日志写入失败', e)
    }

    return { ok: true, bill: { id: bill.id, code: bill.code }, created: true }
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      const again = await db.bill.findFirst({
        where: { companyId: input.companyId, workOrderId: input.workOrderId, billSource: 'work_order_fee' },
        orderBy: { id: 'desc' },
      })
      if (again) {
        return { ok: true, bill: { id: again.id, code: again.code }, created: false }
      }
    }
    throw e
  }
}

export async function findPendingFeeCheckoutPayment(
  db: PrismaClient,
  billId: number,
  companyId: number
) {
  return db.payment.findFirst({
    where: {
      companyId,
      relatedBillId: billId,
      paymentStatus: 'pending',
    },
    orderBy: { id: 'desc' },
  })
}

export async function createFeeCheckoutPayment(
  db: PrismaClient,
  input: {
    billId: number
    companyId: number
    tenantId: number
    channel: 'wechat' | 'alipay'
    payer: string
    operator: ReturnType<typeof operatorFromAuthUser>
  }
): Promise<
  | {
      ok: true
      payment: { id: number; code: string; paymentMethod: string; totalAmount: number }
    }
  | { ok: false; message: string; status: number }
> {
  const bill = await db.bill.findFirst({
    where: { id: input.billId, companyId: input.companyId, tenantId: input.tenantId },
  })
  if (!bill) {
    return { ok: false, message: '账单不存在', status: 404 }
  }
  if (bill.billSource !== 'work_order_fee' || bill.workOrderId == null) {
    return { ok: false, message: '非工单费用账单', status: 400 }
  }
  if (bill.paymentStatus === 'paid') {
    return { ok: false, message: '账单已结清', status: 400 }
  }

  const wo = await db.workOrder.findFirst({
    where: {
      id: bill.workOrderId,
      companyId: input.companyId,
      status: '待租客确认费用',
    },
  })
  if (!wo) {
    return { ok: false, message: '工单状态已变更，请刷新后重试', status: 400 }
  }

  const pending = await findPendingFeeCheckoutPayment(db, input.billId, input.companyId)
  if (pending) {
    return {
      ok: true,
      payment: {
        id: pending.id,
        code: pending.code,
        paymentMethod: pending.paymentMethod,
        totalAmount: Number(pending.totalAmount),
      },
    }
  }

  const amountDue = Number(bill.amountDue)
  if (!Number.isFinite(amountDue) || amountDue <= 0) {
    return { ok: false, message: '账单待缴金额无效', status: 400 }
  }

  const paymentMethod = channelToPaymentMethod(input.channel)

  const payment = await db.$transaction(async (tx) => {
    const code = await allocateUniquePaymentCode(tx)
    return tx.payment.create({
      data: {
        code,
        tenantId: input.tenantId,
        paidAt: new Date(),
        payer: input.payer.trim() || '租客',
        totalAmount: new Decimal(amountDue),
        paymentMethod,
        paymentStatus: 'pending',
        transactionId: null,
        operatorId: input.operator.operatorId,
        companyId: input.companyId,
        relatedBillId: input.billId,
      },
    })
  })

  return {
    ok: true,
    payment: {
      id: payment.id,
      code: payment.code,
      paymentMethod,
      totalAmount: amountDue,
    },
  }
}

export async function completeWorkOrderFeePayment(
  db: PrismaClient,
  input: {
    paymentId: number
    companyId: number
    tenantIds: number[]
    user: AuthUser
    /** 第三方支付单号；未接网关时可由前端在模拟环境传入，或由系统生成 MOCK 号 */
    gatewayTradeNo?: string | null
  }
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const op = operatorFromAuthUser(input.user)

  const payment = await db.payment.findFirst({
    where: {
      id: input.paymentId,
      companyId: input.companyId,
      tenantId: { in: input.tenantIds },
    },
  })
  if (!payment) {
    return { ok: false, message: '缴费单不存在', status: 404 }
  }
  if (payment.relatedBillId == null) {
    return { ok: false, message: '非在线支付缴费单', status: 400 }
  }

  if (payment.paymentStatus === 'success') {
    const linkedBill = await db.bill.findFirst({
      where: { id: payment.relatedBillId, companyId: input.companyId },
    })
    if (linkedBill?.workOrderId != null) {
      const w = await db.workOrder.findUnique({ where: { id: linkedBill.workOrderId } })
      if (w?.status === '待处理' || (w?.status === '处理中' && w.feeConfirmedAt)) {
        return { ok: true }
      }
    }
    return { ok: false, message: '该缴费单已完成，但工单状态异常，请联系物业', status: 409 }
  }

  if (payment.paymentStatus !== 'pending') {
    return {
      ok: false,
      message:
        payment.paymentStatus === 'cancelled'
          ? '该笔支付已取消'
          : payment.paymentStatus === 'failed'
            ? '该笔支付已失败，请重新发起'
            : '该缴费单不可再次确认',
      status: 400,
    }
  }

  const bill = await db.bill.findFirst({
    where: {
      id: payment.relatedBillId,
      companyId: input.companyId,
      tenantId: { in: input.tenantIds },
      billSource: 'work_order_fee',
    },
  })
  if (!bill || bill.workOrderId == null) {
    return { ok: false, message: '关联账单不存在', status: 404 }
  }

  const wo = await db.workOrder.findFirst({
    where: {
      id: bill.workOrderId,
      companyId: input.companyId,
      OR: [{ tenantId: { in: input.tenantIds } }, { reporterId: input.user.id }],
    },
  })
  if (!wo) {
    return { ok: false, message: '工单不存在', status: 404 }
  }

  if (wo.status !== '待租客确认费用') {
    if (wo.status === '待处理' || (wo.status === '处理中' && wo.feeConfirmedAt)) {
      return { ok: true }
    }
    return { ok: false, message: '工单状态已变更，无法完成该笔支付确认', status: 400 }
  }

  const payAmount = Number(payment.totalAmount)
  const amountDueBefore = Number(bill.amountDue)
  if (!Number.isFinite(payAmount) || payAmount <= 0 || payAmount > amountDueBefore + 1e-6) {
    return { ok: false, message: '支付金额与账单待缴不一致', status: 400 }
  }

  const gatewayNo =
    (input.gatewayTradeNo && String(input.gatewayTradeNo).trim()) ||
    `MOCK-${payment.id}-${Date.now()}`

  const billBefore = { ...bill }
  const newPaid = Number(bill.amountPaid) + payAmount
  const newDue = amountDueBefore - payAmount
  const paymentStatus = newDue <= 0 ? 'paid' : 'partial'

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        paymentStatus: 'success',
        paidAt: new Date(),
        transactionId: gatewayNo,
      },
    })

    await tx.paymentBill.create({
      data: {
        paymentId: payment.id,
        billId: bill.id,
        billCode: bill.code,
        amount: new Decimal(payAmount),
        amountDueBefore: new Decimal(amountDueBefore),
        amountDueAfter: new Decimal(newDue),
      },
    })

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        amountPaid: new Decimal(newPaid),
        amountDue: new Decimal(newDue),
        paymentStatus,
      },
    })

    await tx.workOrder.update({
      where: { id: wo.id },
      data: {
        status: '待处理',
        feeConfirmedAt: new Date(),
      },
    })
  })

  const methodLabel = payment.paymentMethod
  const summary = `待租客确认费用 → 待处理；租客已在线支付 ${formatMoneyYuan(payAmount)}（${methodLabel}）；缴费单 ${payment.code}；第三方订单号 ${gatewayNo}；支付状态：成功`

  await logWorkOrderActivity(db, {
    workOrderId: wo.id,
    workOrderCode: wo.code,
    companyId: input.companyId,
    action: WORK_ORDER_ACTION.FEE_CONFIRM_TENANT,
    summary,
    meta: {
      paymentId: payment.id,
      paymentCode: payment.code,
      paymentMethod: methodLabel,
      amount: payAmount,
      gatewayTradeNo: gatewayNo,
      paymentOrderStatus: 'success',
      billId: bill.id,
      billCode: bill.code,
    },
    ...op,
  })

  try {
    await logBillActivity(db, {
      billId: bill.id,
      billCode: bill.code,
      companyId: input.companyId,
      action: BILL_ACTION.PAYMENT,
      summary: `线上缴费入账（工单费用，缴费单 ${payment.code}）`,
      changes: [
        {
          field: 'amountPaid',
          label: '已缴金额',
          from: formatMoneyYuan(Number(billBefore.amountPaid)),
          to: formatMoneyYuan(newPaid),
        },
        {
          field: 'amountDue',
          label: '待缴金额',
          from: formatMoneyYuan(amountDueBefore),
          to: formatMoneyYuan(newDue),
        },
        {
          field: 'paymentStatus',
          label: '结清状态',
          from: paymentStatusZh(billBefore.paymentStatus ?? ''),
          to: paymentStatusZh(paymentStatus),
        },
      ],
      meta: {
        paymentId: payment.id,
        paymentCode: payment.code,
        paymentMethod: methodLabel,
        allocatedAmount: payAmount,
        gatewayTradeNo: gatewayNo,
        workOrderId: wo.id,
        workOrderCode: wo.code,
      },
      operatorId: op.operatorId ?? 0,
      operatorName: op.operatorName ?? '',
      operatorPhone: op.operatorPhone ?? '',
    })
  } catch (e) {
    console.error('[work-order-fee-pay] 工单已推进，账单日志写入失败', e)
  }

  return { ok: true }
}

export async function cancelPendingFeePaymentsForWorkOrderBill(
  db: PrismaClient,
  billId: number,
  companyId: number
): Promise<void> {
  await db.payment.updateMany({
    where: {
      companyId,
      relatedBillId: billId,
      paymentStatus: 'pending',
    },
    data: { paymentStatus: 'cancelled' },
  })
}

/** 租客端打开费用准备页时：若工单已为「待租客确认费用」且费用合计为 0，直接回到处理中（无需账单与支付） */
export async function tryAdvanceWorkOrderZeroFeeOnTenantPrepare(
  db: PrismaClient,
  input: {
    workOrderId: number
    companyId: number
    tenantIds: number[]
    tenantUserId: number
    operator: ReturnType<typeof operatorFromAuthUser>
  }
): Promise<{ advanced: boolean }> {
  const wo = await db.workOrder.findFirst({
    where: {
      id: input.workOrderId,
      companyId: input.companyId,
      status: '待租客确认费用',
      OR: [{ tenantId: { in: input.tenantIds } }, { reporterId: input.tenantUserId }],
    },
  })
  if (!wo) return { advanced: false }

  const feeNum =
    wo.feeTotal != null && Number.isFinite(Number(wo.feeTotal)) ? Number(wo.feeTotal) : NaN
  if (feeNum !== 0) return { advanced: false }

  const op = input.operator
  await db.workOrder.update({
    where: { id: wo.id },
    data: { status: '处理中', feeConfirmedAt: new Date() },
  })
  await logWorkOrderActivity(db, {
    workOrderId: wo.id,
    workOrderCode: wo.code,
    companyId: input.companyId,
    action: WORK_ORDER_ACTION.FEE_ZERO_SKIP_TENANT,
    summary: '待租客确认费用 → 处理中；费用合计为 0 元，系统自动跳过在线支付',
    changes: [
      {
        field: 'status',
        label: '状态',
        from: '待租客确认费用',
        to: '处理中',
      },
    ],
    meta: { feeTotal: 0, skipTenantFee: true },
    operatorId: op.operatorId ?? null,
    operatorName: op.operatorName ?? null,
    operatorPhone: op.operatorPhone ?? null,
  })
  return { advanced: true }
}
