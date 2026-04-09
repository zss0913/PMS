import type { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { allocateUniqueRefundCode } from '@/lib/refund-code'
import {
  BILL_ACTION,
  billStatusZh,
  formatMoneyYuan,
  logBillActivity,
  paymentStatusZh,
} from '@/lib/bill-activity-log'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'
import type { AuthUser } from '@/lib/auth'

/**
 * 员工：「待处理」且存在工单费用账单（`billSource: work_order_fee`）时，退费冲账并取消工单。
 * 将最近一笔成功的工单费用缴费单冲回账单，工单置为已取消，并将关联账单 `status` 置为 `closed`。
 * 无账单（如内部确认费用）时返回错误，由前端隐藏「退费并取消」入口。
 */
export async function refundWorkOrderFeeAndCancelOrder(
  db: PrismaClient,
  input: {
    workOrderId: number
    companyId: number
    user: AuthUser
    reason?: string
  }
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const op = operatorFromAuthUser(input.user)

  const wo = await db.workOrder.findFirst({
    where: { id: input.workOrderId, companyId: input.companyId },
  })
  if (!wo) {
    return { ok: false, message: '工单不存在', status: 404 }
  }
  if (wo.status !== '待处理') {
    return { ok: false, message: '仅「待处理」（租客已支付费用）的工单可退费并取消', status: 400 }
  }

  const bill = await db.bill.findFirst({
    where: {
      companyId: input.companyId,
      workOrderId: wo.id,
      billSource: 'work_order_fee',
    },
    orderBy: { id: 'desc' },
  })

  if (!bill) {
    return {
      ok: false,
      message:
        '本工单未产生工单费用账单（例如已选「仅内部确认费用」），无需退费冲账，请勿使用本操作。',
      status: 400,
    }
  }

  const payment = await db.payment.findFirst({
    where: {
      companyId: input.companyId,
      relatedBillId: bill.id,
      paymentStatus: 'success',
    },
    orderBy: { id: 'desc' },
  })

  const reasonLine = input.reason?.trim() ? `；原因：${input.reason.trim().slice(0, 200)}` : ''

  if (!payment) {
    await db.$transaction(async (tx) => {
      await tx.workOrder.update({
        where: { id: wo.id },
        data: { status: '已取消' },
      })
      await tx.bill.update({
        where: { id: bill.id },
        data: { status: 'closed' },
      })
    })
    await logWorkOrderActivity(db, {
      workOrderId: wo.id,
      workOrderCode: wo.code,
      companyId: input.companyId,
      action: WORK_ORDER_ACTION.REFUND_FEE_CANCEL,
      summary: `待处理 → 已取消（有账单但无成功缴费可冲回；关联账单 ${bill.code} 已关闭）${reasonLine}`,
      ...op,
    })
    try {
      await logBillActivity(db, {
        billId: bill.id,
        billCode: bill.code,
        companyId: input.companyId,
        action: BILL_ACTION.UPDATE,
        summary: `工单退费并取消：无成功缴费可冲回，账单随工单关闭${reasonLine}`,
        changes: [
          {
            field: 'status',
            label: '状态',
            from: billStatusZh(bill.status),
            to: billStatusZh('closed'),
          },
        ],
        meta: { workOrderId: wo.id, workOrderCode: wo.code, closeReason: 'refund_cancel_no_payment' },
        operatorId: op.operatorId ?? 0,
        operatorName: op.operatorName ?? '',
        operatorPhone: op.operatorPhone ?? '',
      })
    } catch (e) {
      console.error('[work-order-fee-refund] 账单日志写入失败（关单无缴费）', e)
    }
    return { ok: true }
  }

  const pb = await db.paymentBill.findFirst({
    where: { paymentId: payment.id, billId: bill.id },
  })
  const payAmount = pb ? Number(pb.amount) : Number(payment.totalAmount)
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    return { ok: false, message: '缴费金额异常，无法退费', status: 400 }
  }

  const amountPaidBefore = Number(bill.amountPaid)
  const amountDueBefore = Number(bill.amountDue)
  if (payAmount - 1e-6 > amountPaidBefore) {
    return { ok: false, message: '账单已缴金额与缴费单不一致，请人工核对', status: 409 }
  }

  const newPaid = Math.max(0, amountPaidBefore - payAmount)
  const newDue = amountDueBefore + payAmount
  const ar = Number(bill.accountReceivable)
  const paymentStatus = newDue >= ar - 1e-6 ? 'unpaid' : 'partial'
  const billBefore = { ...bill }

  const refundReasonText = input.reason?.trim() || '工单退费冲账并关单'
  const refunderLabel =
    [op.operatorName?.trim(), op.operatorPhone?.trim()].filter(Boolean).join(' ') || '员工'

  const refundRow = await db.$transaction(async (tx) => {
    const code = await allocateUniqueRefundCode(tx)
    const rf = await tx.refund.create({
      data: {
        code,
        billId: bill.id,
        tenantId: bill.tenantId,
        refundAt: new Date(),
        refunder: refunderLabel,
        operatorId: input.user.id,
        amount: new Decimal(payAmount),
        reason: refundReasonText,
        remark: `作废缴费单 ${payment.code}；工单 ${wo.code} 已取消`,
        companyId: input.companyId,
      },
    })

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        paymentStatus: 'cancelled',
        transactionId: payment.transactionId
          ? `${payment.transactionId}|voided-${Date.now()}`
          : `VOID-${payment.id}-${Date.now()}`,
      },
    })

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        amountPaid: new Decimal(newPaid),
        amountDue: new Decimal(newDue),
        paymentStatus,
        /** 退费冲账后不再催收该笔工单费用账单 */
        status: 'closed',
      },
    })

    await tx.workOrder.update({
      where: { id: wo.id },
      data: { status: '已取消' },
    })

    return rf
  })

  await logWorkOrderActivity(db, {
    workOrderId: wo.id,
    workOrderCode: wo.code,
    companyId: input.companyId,
    action: WORK_ORDER_ACTION.REFUND_FEE_CANCEL,
    summary: `待处理 → 已取消；退费冲账 ${formatMoneyYuan(payAmount)}，缴费单 ${payment.code} 已作废；关联账单 ${bill.code} 已关闭${reasonLine}`,
    changes: [
      { field: 'status', label: '状态', from: '待处理', to: '已取消' },
    ],
    meta: {
      paymentId: payment.id,
      paymentCode: payment.code,
      billId: bill.id,
      billCode: bill.code,
      refundAmount: payAmount,
    },
    ...op,
  })

  try {
    await logBillActivity(db, {
      billId: bill.id,
      billCode: bill.code,
      companyId: input.companyId,
      action: BILL_ACTION.REFUND,
      summary: `退费（退费单 ${refundRow.code}）· 工单冲账关单，缴费单 ${payment.code} 已作废；账单已关闭${reasonLine}`,
      changes: [
        {
          field: 'amountPaid',
          label: '已缴金额',
          from: formatMoneyYuan(amountPaidBefore),
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
        {
          field: 'status',
          label: '状态',
          from: billStatusZh(billBefore.status),
          to: billStatusZh('closed'),
        },
      ],
      meta: {
        refundId: refundRow.id,
        refundCode: refundRow.code,
        amount: payAmount,
        reason: refundReasonText,
        refunder: refunderLabel,
        paymentId: payment.id,
        paymentCode: payment.code,
        workOrderId: wo.id,
      },
      operatorId: op.operatorId ?? 0,
      operatorName: op.operatorName ?? '',
      operatorPhone: op.operatorPhone ?? '',
    })
  } catch (e) {
    console.error('[work-order-fee-refund] 账单日志写入失败', e)
  }

  return { ok: true }
}
