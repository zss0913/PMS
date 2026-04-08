import type { Prisma, PrismaClient } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { Decimal, PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import {
  logBillActivity,
  BILL_ACTION,
  authUserForLog,
  formatMoneyYuan,
  paymentStatusZh,
} from '@/lib/bill-activity-log'
import { operatorFromAuthUser } from '@/lib/work-order-activity-log'
import { channelToPaymentMethod } from '@/lib/mp-work-order-fee-pay'

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

export async function assertBillAllowsGeneralTenantCheckout(
  db: PrismaClient,
  bill: { billSource: string; workOrderId: number | null },
  companyId: number
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  if (bill.billSource !== 'work_order_fee' || bill.workOrderId == null) {
    return { ok: true }
  }
  const wo = await db.workOrder.findFirst({
    where: { id: bill.workOrderId, companyId },
  })
  if (!wo) {
    return { ok: false, message: '关联工单不存在', status: 400 }
  }
  if (wo.status === '待租客确认费用') {
    return {
      ok: false,
      message: '请先在工单详情中确认费用并发起工单费用支付',
      status: 400,
    }
  }
  return { ok: true }
}

export async function createTenantBillCheckout(
  db: PrismaClient,
  input: {
    billId: number
    companyId: number
    tenantIds: number[]
    channel: 'wechat' | 'alipay'
    payer: string
    user: AuthUser
  }
): Promise<
  | { ok: true; payment: { id: number; code: string; paymentMethod: string; totalAmount: number } }
  | { ok: false; message: string; status: number }
> {
  const bill = await db.bill.findFirst({
    where: {
      id: input.billId,
      companyId: input.companyId,
      tenantId: { in: input.tenantIds },
    },
  })
  if (!bill) {
    return { ok: false, message: '账单不存在', status: 404 }
  }
  if (bill.paymentStatus === 'paid' || Number(bill.amountDue) <= 0) {
    return { ok: false, message: '账单已结清或无待缴金额', status: 400 }
  }

  const gate = await assertBillAllowsGeneralTenantCheckout(db, bill, input.companyId)
  if (!gate.ok) return gate

  const pending = await db.payment.findFirst({
    where: {
      companyId: input.companyId,
      relatedBillId: input.billId,
      tenantId: bill.tenantId,
      paymentStatus: 'pending',
      pendingBillIdsJson: null,
    },
    orderBy: { id: 'desc' },
  })
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
  const op = operatorFromAuthUser(input.user)

  try {
    const payment = await db.$transaction(async (tx) => {
      const code = await allocateUniquePaymentCode(tx)
      return tx.payment.create({
        data: {
          code,
          tenantId: bill.tenantId,
          paidAt: new Date(),
          payer: input.payer.trim() || '租客',
          totalAmount: new Decimal(amountDue),
          paymentMethod,
          paymentStatus: 'pending',
          transactionId: null,
          operatorId: op.operatorId ?? null,
          companyId: input.companyId,
          relatedBillId: input.billId,
          pendingBillIdsJson: null,
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
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, message: '请重试下单', status: 409 }
    }
    throw e
  }
}

function stableBillIdsJson(ids: number[]): string {
  const u = [...new Set(ids)].sort((a, b) => a - b)
  return JSON.stringify(u)
}

export async function createTenantBatchBillCheckout(
  db: PrismaClient,
  input: {
    billIds: number[]
    companyId: number
    tenantIds: number[]
    channel: 'wechat' | 'alipay'
    payer: string
    user: AuthUser
  }
): Promise<
  | { ok: true; payment: { id: number; code: string; paymentMethod: string; totalAmount: number } }
  | { ok: false; message: string; status: number }
> {
  const ids = [...new Set(input.billIds)].filter((x) => x > 0)
  if (ids.length < 2) {
    return { ok: false, message: '合并支付请至少选择 2 笔账单', status: 400 }
  }

  const bills = await db.bill.findMany({
    where: {
      id: { in: ids },
      companyId: input.companyId,
      tenantId: { in: input.tenantIds },
      paymentStatus: { not: 'paid' },
    },
    orderBy: { dueDate: 'asc' },
  })

  if (bills.length !== ids.length) {
    return { ok: false, message: '部分账单不存在或不可缴', status: 400 }
  }

  const tenantId = bills[0]!.tenantId
  if (!bills.every((b) => b.tenantId === tenantId)) {
    return { ok: false, message: '合并支付仅支持同一租客主体下的账单', status: 400 }
  }

  for (const b of bills) {
    const gate = await assertBillAllowsGeneralTenantCheckout(db, b, input.companyId)
    if (!gate.ok) return gate
    if (Number(b.amountDue) <= 0) {
      return { ok: false, message: `账单 ${b.code} 无待缴金额`, status: 400 }
    }
  }

  const jsonKey = stableBillIdsJson(ids)
  const existing = await db.payment.findFirst({
    where: {
      companyId: input.companyId,
      tenantId,
      paymentStatus: 'pending',
      pendingBillIdsJson: jsonKey,
    },
    orderBy: { id: 'desc' },
  })
  if (existing) {
    return {
      ok: true,
      payment: {
        id: existing.id,
        code: existing.code,
        paymentMethod: existing.paymentMethod,
        totalAmount: Number(existing.totalAmount),
      },
    }
  }

  const total = bills.reduce((s, b) => s + Number(b.amountDue), 0)
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, message: '待缴金额无效', status: 400 }
  }

  const paymentMethod = channelToPaymentMethod(input.channel)
  const op = operatorFromAuthUser(input.user)

  const payment = await db.$transaction(async (tx) => {
    const code = await allocateUniquePaymentCode(tx)
    return tx.payment.create({
      data: {
        code,
        tenantId,
        paidAt: new Date(),
        payer: input.payer.trim() || '租客',
        totalAmount: new Decimal(total),
        paymentMethod,
        paymentStatus: 'pending',
        transactionId: null,
        operatorId: op.operatorId ?? null,
        companyId: input.companyId,
        relatedBillId: null,
        pendingBillIdsJson: jsonKey,
      },
    })
  })

  return {
    ok: true,
    payment: {
      id: payment.id,
      code: payment.code,
      paymentMethod,
      totalAmount: total,
    },
  }
}

export async function completeTenantBillOnlinePayment(
  db: PrismaClient,
  input: {
    paymentId: number
    companyId: number
    tenantIds: number[]
    user: AuthUser
    gatewayTradeNo?: string | null
  }
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
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
  if (payment.paymentStatus === 'success') {
    return { ok: true }
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

  const gatewayNo =
    (input.gatewayTradeNo && String(input.gatewayTradeNo).trim()) ||
    `MOCK-${payment.id}-${Date.now()}`

  const op = authUserForLog(input.user)

  /** 单笔：relatedBillId */
  if (payment.relatedBillId != null && !payment.pendingBillIdsJson) {
    const bill = await db.bill.findFirst({
      where: {
        id: payment.relatedBillId,
        companyId: input.companyId,
        tenantId: { in: input.tenantIds },
      },
    })
    if (!bill) {
      return { ok: false, message: '关联账单不存在', status: 404 }
    }
    const gate = await assertBillAllowsGeneralTenantCheckout(db, bill, input.companyId)
    if (!gate.ok) return gate

    const payAmount = Number(payment.totalAmount)
    const amountDueBefore = Number(bill.amountDue)
    if (!Number.isFinite(payAmount) || payAmount <= 0 || payAmount > amountDueBefore + 1e-6) {
      return { ok: false, message: '支付金额与账单待缴不一致', status: 400 }
    }

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
    })

    try {
      await logBillActivity(db, {
        billId: bill.id,
        billCode: bill.code,
        companyId: input.companyId,
        action: BILL_ACTION.PAYMENT,
        summary: `线上缴费入账（租客端，缴费单 ${payment.code}）`,
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
          paymentMethod: payment.paymentMethod,
          allocatedAmount: payAmount,
          gatewayTradeNo: gatewayNo,
        },
        operatorId: op.operatorId ?? 0,
        operatorName: op.operatorName ?? '',
        operatorPhone: op.operatorPhone ?? '',
      })
    } catch (e) {
      console.error('[mp-bill-tenant-pay] 账单日志写入失败', e)
    }

    return { ok: true }
  }

  /** 批量：pendingBillIdsJson */
  if (payment.pendingBillIdsJson) {
    let billIds: number[] = []
    try {
      const parsed = JSON.parse(payment.pendingBillIdsJson) as unknown
      if (!Array.isArray(parsed)) throw new Error('bad')
      billIds = parsed.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)
    } catch {
      return { ok: false, message: '缴费单数据异常', status: 400 }
    }
    if (billIds.length < 2) {
      return { ok: false, message: '缴费单数据异常', status: 400 }
    }

    const bills = await db.bill.findMany({
      where: {
        id: { in: billIds },
        companyId: input.companyId,
        tenantId: payment.tenantId,
        paymentStatus: { not: 'paid' },
      },
      orderBy: { dueDate: 'asc' },
    })
    if (bills.length !== billIds.length) {
      return { ok: false, message: '部分账单已变更，请重新发起支付', status: 400 }
    }
    for (const b of bills) {
      const gate = await assertBillAllowsGeneralTenantCheckout(db, b, input.companyId)
      if (!gate.ok) return gate
    }

    const totalDue = bills.reduce((s, b) => s + Number(b.amountDue), 0)
    const payTotal = Number(payment.totalAmount)
    if (!Number.isFinite(payTotal) || payTotal <= 0 || Math.abs(payTotal - totalDue) > 1e-2) {
      return { ok: false, message: '支付金额与账单待缴不一致', status: 400 }
    }

    let remaining = payTotal
    const lines: {
      bill: (typeof bills)[0]
      payAmount: number
      amountDueBefore: number
      amountDueAfter: number
    }[] = []

    for (const bill of bills) {
      if (remaining <= 0) break
      const amountDueBefore = Number(bill.amountDue)
      const payAmount = Math.min(remaining, amountDueBefore)
      if (payAmount <= 0) continue
      const amountDueAfter = amountDueBefore - payAmount
      remaining -= payAmount
      lines.push({ bill, payAmount, amountDueBefore, amountDueAfter })
    }

    if (lines.length === 0 || remaining > 1e-6) {
      return { ok: false, message: '账单分配失败，请刷新后重试', status: 400 }
    }

    const pendingLogs: Parameters<typeof logBillActivity>[1][] = []

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          paymentStatus: 'success',
          paidAt: new Date(),
          transactionId: gatewayNo,
        },
      })

      for (const line of lines) {
        const b = line.bill
        const billBefore = await tx.bill.findUnique({ where: { id: b.id } })
        if (!billBefore) throw new Error(`账单 ${b.id} 不存在`)
        const newPaid = Number(billBefore.amountPaid) + line.payAmount
        const newDue = line.amountDueAfter
        const ps = newDue <= 0 ? 'paid' : 'partial'

        await tx.paymentBill.create({
          data: {
            paymentId: payment.id,
            billId: b.id,
            billCode: b.code,
            amount: new Decimal(line.payAmount),
            amountDueBefore: new Decimal(line.amountDueBefore),
            amountDueAfter: new Decimal(newDue),
          },
        })
        await tx.bill.update({
          where: { id: b.id },
          data: {
            amountPaid: new Decimal(newPaid),
            amountDue: new Decimal(newDue),
            paymentStatus: ps,
          },
        })

        pendingLogs.push({
          billId: b.id,
          billCode: b.code,
          companyId: input.companyId,
          action: BILL_ACTION.PAYMENT,
          summary: `线上缴费入账（租客端合并支付，缴费单 ${payment.code}）`,
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
              from: formatMoneyYuan(Number(billBefore.amountDue)),
              to: formatMoneyYuan(newDue),
            },
            {
              field: 'paymentStatus',
              label: '结清状态',
              from: paymentStatusZh(billBefore.paymentStatus ?? ''),
              to: paymentStatusZh(ps),
            },
          ],
          meta: {
            paymentId: payment.id,
            paymentCode: payment.code,
            paymentMethod: payment.paymentMethod,
            allocatedAmount: line.payAmount,
            gatewayTradeNo: gatewayNo,
            batch: true,
          },
          operatorId: op.operatorId ?? 0,
          operatorName: op.operatorName ?? '',
          operatorPhone: op.operatorPhone ?? '',
        })
      }
    })

    for (const log of pendingLogs) {
      try {
        await logBillActivity(db, log)
      } catch (e) {
        console.error('[mp-bill-tenant-pay] 合并支付日志写入失败', e)
      }
    }

    return { ok: true }
  }

  return { ok: false, message: '非在线支付待确认缴费单', status: 400 }
}
