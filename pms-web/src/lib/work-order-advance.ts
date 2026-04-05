import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import {
  isTenantSubmittedWorkOrderSource,
  validateWorkOrderCompletionImageUrls,
} from '@/lib/work-order'
import {
  WORK_ORDER_ACTION,
  logWorkOrderActivity,
  operatorFromAuthUser,
} from '@/lib/work-order-activity-log'

export const workOrderAdvanceBodySchema = z.object({
  action: z.enum([
    'start_processing',
    'request_fee_confirmation',
    /** 处理中：无费用，跳过租客确认与支付 */
    'no_fee_continue',
    /** 员工核对无误后送租客确认费用 */
    'publish_fee_for_tenant',
    'complete_for_evaluation',
    /** 非租客报修工单：员工可直接标记评价完成；评价内容选填 */
    'mark_evaluated',
    /** 租客报修工单：仅租客可提交，进入评价完成 */
    'submit_tenant_evaluation',
    'cancel',
  ]),
  feeRemark: z.string().optional(),
  /** 费用合计（元），提交「待员工确认费用」时必填且须 > 0 */
  feeTotal: z.union([z.number(), z.string()]).optional(),
  /** 办结待评价：现场照片 URL，1～10 张 */
  completionImages: z.array(z.string().min(1)).max(10).optional(),
  completionRemark: z.string().max(2000).optional(),
  /** 评价说明：员工 mark_evaluated 或租客 submit_tenant_evaluation 选填 */
  evaluationContent: z.string().max(2000).optional(),
})

/** 解析请求体中的费用合计（元）：必填场景由调用方保证传入 */
function parseWorkOrderFeeTotalYuan(
  raw: unknown
): { ok: true; yuan: number } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, message: '请填写费用合计' }
  }
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseFloat(raw.trim().replace(/,/g, ''))
        : NaN
  if (!Number.isFinite(n)) {
    return { ok: false, message: '费用合计须为有效数字' }
  }
  const rounded = Math.round(n * 100) / 100
  if (rounded <= 0) {
    return { ok: false, message: '费用合计须大于 0' }
  }
  if (rounded > 1e9) {
    return { ok: false, message: '费用合计金额过大' }
  }
  return { ok: true, yuan: rounded }
}

function formatFeeTotalForLog(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '（空）'
  return `${Number(v).toFixed(2)} 元`
}

/** Prisma Client 未执行 generate 时，update 的 data 里含 feeTotal 会报 Unknown argument */
function isPrismaClientStaleMissingFeeTotal(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e)
  return /Unknown argument/i.test(s) && /feeTotal/i.test(s)
}

/** 数据库表上确无 feeTotal 列（与「客户端不认识 feeTotal」不同） */
function isMissingWorkOrderFeeTotalColumnError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2022') return true
  }
  const s = e instanceof Error ? e.message : String(e)
  if (/Unknown argument/i.test(s)) return false
  return (
    /no such column[^.\n]*feeTotal/i.test(s) ||
    /Unknown column[^.\n]*[`']?feeTotal[`']?/i.test(s) ||
    (/does not exist/i.test(s) && /feeTotal/i.test(s))
  )
}

export type WorkOrderAdvanceParsed = z.infer<typeof workOrderAdvanceBodySchema>

/**
 * 工单流程推进（开始处理 / 费用 / 办结 / 评价 / 取消），PC 与小程序共用。
 */
export async function runWorkOrderAdvance(
  user: AuthUser,
  workOrderId: number,
  parsed: WorkOrderAdvanceParsed
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const wo = await prisma.workOrder.findFirst({
    where: { id: workOrderId, companyId: user.companyId },
  })
  if (!wo) {
    return { ok: false, message: '工单不存在', status: 404 }
  }

  const now = new Date()
  const op = operatorFromAuthUser(user)

  switch (parsed.action) {
    case 'start_processing': {
      if (wo.status !== '待响应') {
        return { ok: false, message: '仅「待响应」的工单可开始处理', status: 400 }
      }
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: { status: '处理中', respondedAt: wo.respondedAt ?? now },
      })
      await logWorkOrderActivity(prisma, {
        workOrderId,
        workOrderCode: wo.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.START_PROCESSING,
        summary: '待响应 → 处理中（开始处理）',
        ...op,
      })
      break
    }
    case 'no_fee_continue': {
      if (wo.status !== '处理中') {
        return { ok: false, message: '仅「处理中」的可登记未产生任何费用', status: 400 }
      }
      const nextRemark = '未产生任何费用'
      const prevRemark =
        wo.feeRemark != null && String(wo.feeRemark).trim() !== ''
          ? String(wo.feeRemark).trim()
          : '（空）'
      const prevTotal = formatFeeTotalForLog(wo.feeTotal)
      const nextTotal = formatFeeTotalForLog(0)
      try {
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: {
            status: '处理中',
            feeTotal: 0,
            feeRemark: nextRemark,
          },
        })
        await logWorkOrderActivity(prisma, {
          workOrderId,
          workOrderCode: wo.code,
          companyId: user.companyId,
          action: WORK_ORDER_ACTION.NO_FEE_CONTINUE,
          summary:
            '处理中：员工确认未产生任何费用，无需租客确认与在线支付，可继续维修直至办结',
          changes: [
            { field: 'feeTotal', label: '费用合计', from: prevTotal, to: nextTotal },
            { field: 'feeRemark', label: '费用说明', from: prevRemark, to: nextRemark },
          ],
          meta: { feeRemark: nextRemark, feeTotal: 0 },
          ...op,
        })
      } catch (e: unknown) {
        if (isPrismaClientStaleMissingFeeTotal(e)) {
          return {
            ok: false,
            message:
              'Prisma 客户端未包含「费用合计」字段定义。请先停止本机的 Next 开发服务（占用的 5001 端口），在 pms-web 目录执行：npx prisma generate，再重新启动服务。',
            status: 503,
          }
        }
        if (isMissingWorkOrderFeeTotalColumnError(e)) {
          return {
            ok: false,
            message:
              '数据库表缺少「费用合计」列（feeTotal）。请在 pms-web 目录执行：npx prisma db push，然后重启 Next 服务。',
            status: 503,
          }
        }
        throw e
      }
      break
    }
    case 'request_fee_confirmation': {
      if (wo.status !== '处理中') {
        return { ok: false, message: '仅「处理中」的工单可提交费用（进入待员工确认）', status: 400 }
      }
      const remark = parsed.feeRemark?.trim() ?? ''
      if (!remark) {
        return { ok: false, message: '请填写费用说明', status: 400 }
      }
      const feeParsed = parseWorkOrderFeeTotalYuan(parsed.feeTotal)
      if (!feeParsed.ok) {
        return { ok: false, message: feeParsed.message, status: 400 }
      }
      const yuan = feeParsed.yuan
      const prevRemark =
        wo.feeRemark != null && String(wo.feeRemark).trim() !== ''
          ? String(wo.feeRemark).trim()
          : '（空）'
      const prevTotal = formatFeeTotalForLog(wo.feeTotal)
      const nextTotal = formatFeeTotalForLog(yuan)
      try {
        await prisma.workOrder.update({
          where: { id: workOrderId },
          data: {
            status: '待员工确认费用',
            feeRemark: remark,
            feeTotal: yuan,
          },
        })
        await logWorkOrderActivity(prisma, {
          workOrderId,
          workOrderCode: wo.code,
          companyId: user.companyId,
          action: WORK_ORDER_ACTION.REQUEST_FEE_CONFIRMATION,
          summary: `处理中 → 待员工确认费用；费用合计 ${nextTotal}；费用说明：${remark.slice(0, 100)}${remark.length > 100 ? '…' : ''}`,
          changes: [
            { field: 'status', label: '状态', from: '处理中', to: '待员工确认费用' },
            { field: 'feeTotal', label: '费用合计', from: prevTotal, to: nextTotal },
            { field: 'feeRemark', label: '费用说明', from: prevRemark, to: remark },
          ],
          meta: { feeRemark: remark, feeTotal: yuan },
          ...op,
        })
      } catch (e: unknown) {
        if (isPrismaClientStaleMissingFeeTotal(e)) {
          return {
            ok: false,
            message:
              'Prisma 客户端未包含「费用合计」字段定义。请先停止本机的 Next 开发服务（占用的 5001 端口），在 pms-web 目录执行：npx prisma generate，再重新启动服务。',
            status: 503,
          }
        }
        if (isMissingWorkOrderFeeTotalColumnError(e)) {
          return {
            ok: false,
            message:
              '数据库表缺少「费用合计」列（feeTotal）。请在 pms-web 目录执行：npx prisma db push，然后重启 Next 服务。',
            status: 503,
          }
        }
        throw e
      }
      break
    }
    case 'publish_fee_for_tenant': {
      if (wo.status !== '待员工确认费用') {
        return {
          ok: false,
          message: '仅「待员工确认费用」的工单可送租客核对',
          status: 400,
        }
      }
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: { status: '待租客确认费用' },
      })
      await logWorkOrderActivity(prisma, {
        workOrderId,
        workOrderCode: wo.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.PUBLISH_FEE_FOR_TENANT,
        summary: '待员工确认费用 → 待租客确认费用（员工已确认并送租客核对）',
        changes: [
          {
            field: 'status',
            label: '状态',
            from: '待员工确认费用',
            to: '待租客确认费用',
          },
        ],
        ...op,
      })
      break
    }
    case 'complete_for_evaluation': {
      if (user.type !== 'employee') {
        return { ok: false, message: '仅物业员工可办结工单', status: 403 }
      }
      if (wo.status !== '处理中') {
        return { ok: false, message: '仅「处理中」的工单可办结并进入待评价', status: 400 }
      }
      const imgCheck = validateWorkOrderCompletionImageUrls(parsed.completionImages)
      if (!imgCheck.ok) {
        return { ok: false, message: imgCheck.message, status: 400 }
      }
      const compRemark = parsed.completionRemark?.trim() ?? ''
      const prevComp = wo.completionImages?.trim() ? '（已有）' : '（空）'
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          status: '待评价',
          completedAt: now,
          completionImages: JSON.stringify(imgCheck.urls),
          completionRemark: compRemark || null,
        },
      })
      await logWorkOrderActivity(prisma, {
        workOrderId,
        workOrderCode: wo.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.COMPLETE_FOR_EVALUATION,
        summary: `处理中 → 待评价（办结）；现场照片 ${imgCheck.urls.length} 张${compRemark ? `；说明：${compRemark.slice(0, 80)}${compRemark.length > 80 ? '…' : ''}` : ''}`,
        changes: [
          {
            field: 'completionImages',
            label: '办结照片',
            from: prevComp,
            to: `${imgCheck.urls.length} 张`,
          },
          {
            field: 'completionRemark',
            label: '办结说明',
            from: wo.completionRemark?.trim() ? String(wo.completionRemark).trim() : '（空）',
            to: compRemark || '（空）',
          },
        ],
        meta: { completionCount: imgCheck.urls.length, completionRemark: compRemark || undefined },
        ...op,
      })
      break
    }
    case 'mark_evaluated': {
      if (user.type !== 'employee') {
        return { ok: false, message: '仅物业员工可标记评价完成', status: 403 }
      }
      if (wo.status !== '待评价') {
        return { ok: false, message: '仅「待评价」的工单可标记为评价完成', status: 400 }
      }
      if (isTenantSubmittedWorkOrderSource(wo.source)) {
        return {
          ok: false,
          message: '租客报修的工单须由租客在租客端完成评价后才会完结，不可由员工直接标记。',
          status: 400,
        }
      }
      const evalNote = parsed.evaluationContent?.trim() ?? ''
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: { status: '评价完成', evaluatedAt: now, evaluationNote: evalNote || null },
      })
      await logWorkOrderActivity(prisma, {
        workOrderId,
        workOrderCode: wo.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.MARK_EVALUATED,
        summary: evalNote
          ? `待评价 → 评价完成（物业确认）；评价：${evalNote.slice(0, 120)}${evalNote.length > 120 ? '…' : ''}`
          : '待评价 → 评价完成（物业确认）',
        meta: evalNote ? { evaluationNote: evalNote } : undefined,
        ...op,
      })
      break
    }
    case 'submit_tenant_evaluation': {
      if (user.type !== 'tenant') {
        return { ok: false, message: '仅租客可提交评价', status: 403 }
      }
      if (!isTenantSubmittedWorkOrderSource(wo.source)) {
        return {
          ok: false,
          message: '本工单非租客报修发起，无需在此提交评价。',
          status: 400,
        }
      }
      if (wo.status !== '待评价') {
        return { ok: false, message: '仅「待评价」时可提交评价', status: 400 }
      }
      const evalNote = parsed.evaluationContent?.trim() ?? ''
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: { status: '评价完成', evaluatedAt: now, evaluationNote: evalNote || null },
      })
      await logWorkOrderActivity(prisma, {
        workOrderId,
        workOrderCode: wo.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.TENANT_SUBMIT_EVALUATION,
        summary: evalNote
          ? `待评价 → 评价完成（租客评价）：${evalNote.slice(0, 120)}${evalNote.length > 120 ? '…' : ''}`
          : '待评价 → 评价完成（租客评价）',
        meta: evalNote ? { evaluationNote: evalNote } : undefined,
        ...op,
      })
      break
    }
    case 'cancel': {
      // 仅「待派单」「待响应」可取消；进入「处理中」及之后不可取消（与 PC/业务一致）
      if (!['待派单', '待响应'].includes(wo.status)) {
        return {
          ok: false,
          message: '仅「待派单」「待响应」的工单可取消',
          status: 400,
        }
      }
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: { status: '已取消' },
      })
      await logWorkOrderActivity(prisma, {
        workOrderId,
        workOrderCode: wo.code,
        companyId: user.companyId,
        action: WORK_ORDER_ACTION.CANCEL,
        summary: `${wo.status} → 已取消`,
        ...op,
      })
      break
    }
    default:
      return { ok: false, message: '未知操作', status: 400 }
  }

  return { ok: true }
}
